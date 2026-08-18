import noBareBoolFormSchema from './no-bare-bool-form-schema.js';
import noTombstoneOrFallback from './no-tombstone-or-fallback.js';
import noDomAttrReadInJsx from './no-dom-attr-read-in-jsx.js';
import noDirectLocalstorageInJsx from './no-direct-localstorage-in-jsx.js';
import yjsBridgeMustRouteThroughApply from './yjs-bridge-must-route-through-apply.js';
import noImperativeDomPatchNearPreact from './no-imperative-dom-patch-near-preact.js';
import noDirectModalRemove from './no-direct-modal-remove.js';
import noRawHtmlInterpolation from './no-raw-html-interpolation.js';

export default {
  rules: {
    'no-bare-bool-form-schema': noBareBoolFormSchema,
    'no-tombstone-or-fallback': noTombstoneOrFallback,
    'no-dom-attr-read-in-jsx': noDomAttrReadInJsx,
    'no-direct-localstorage-in-jsx': noDirectLocalstorageInJsx,
    'yjs-bridge-must-route-through-apply': yjsBridgeMustRouteThroughApply,
    'no-imperative-dom-patch-near-preact': noImperativeDomPatchNearPreact,
    'no-direct-modal-remove': noDirectModalRemove,
    'no-raw-html-interpolation': noRawHtmlInterpolation,
  },
};
