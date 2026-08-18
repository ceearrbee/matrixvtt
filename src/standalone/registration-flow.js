/**
 * Pure UIA (user-interactive auth) flow machine for in-app Matrix
 * registration. No DOM, no network: the RegisterPanel drives the
 * HTTP calls and feeds each server response back through here.
 *
 * Only script-free stages are supported. m.login.recaptcha needs
 * Google script origins the static-site CSP forbids, so servers that
 * require it (matrix.org included) keep the element.io sign-up exit.
 */

export const SUPPORTED_STAGES = [
  'm.login.dummy',
  'm.login.terms',
  'm.login.registration_token',
  'm.login.email.identity',
];

export function pickSupportedFlow(flows) {
  for (const f of flows ?? []) {
    const stages = f?.stages ?? [];
    if (stages.length > 0 && stages.every((s) => SUPPORTED_STAGES.includes(s))) {
      return stages;
    }
  }
  return null;
}

/** Start a flow from the server's initial 401 UIA body. */
export function beginFlow(uia) {
  const stages = pickSupportedFlow(uia?.flows);
  return {
    session: uia?.session ?? null,
    params: uia?.params ?? {},
    stages,
    completed: uia?.completed ?? [],
    supported: stages !== null,
  };
}

/** The first stage of the chosen flow the server has not confirmed yet. */
export function nextStage(flow) {
  if (!flow?.stages) return null;
  return flow.stages.find((s) => !flow.completed.includes(s)) ?? null;
}

/** Fold a follow-up 401 UIA body into the flow state. */
export function applyUiaUpdate(flow, uia) {
  return {
    ...flow,
    session: uia?.session ?? flow.session,
    params: uia?.params ?? flow.params,
    completed: uia?.completed ?? flow.completed,
  };
}

/** Flatten m.login.terms params into displayable name/url pairs. */
export function termsPolicies(params) {
  const policies = params?.['m.login.terms']?.policies ?? {};
  return Object.values(policies)
    .map((p) => {
      const lang = p?.en
        ?? Object.values(p ?? {}).find((v) => v && typeof v === 'object' && typeof v.url === 'string');
      return { name: lang?.name ?? 'Terms', url: lang?.url ?? '' };
    })
    .filter((p) => p.url);
}

/** Build the auth dict for one stage submission. */
export function authDictFor(stage, flow, extras = {}) {
  const base = { type: stage, session: flow.session };
  if (stage === 'm.login.registration_token') {
    return { ...base, token: extras.token };
  }
  if (stage === 'm.login.email.identity') {
    return { ...base, threepid_creds: { sid: extras.sid, client_secret: extras.clientSecret } };
  }
  return base;
}
