/**
 * Stub replacement for @matrix-org/matrix-sdk-crypto-wasm.
 * MatrixVTT operates without E2EE rust-crypto in browser bundles.
 */

export async function initAsync() {}
export function getVersions() { return {}; }

export class Attachment {}
export class BackupDecryptionKey {}
export class BackupKeys {}
export class BackupSecretsBundle {}
export class Base64EncodedPkMessage {}
export class BaseMigrationData {}
export class CancelInfo {}
export class CheckCode {}
export class CollectStrategy {}
export class CrossSigningBootstrapRequests {}
export class CrossSigningKeyExport {}
export class CrossSigningStatus {}
export class Curve25519PublicKey {}
export class Curve25519SecretKey {}
export class DecryptedRoomEvent {}
export class DecryptedToDeviceEvent {}
export class DecryptionSettings {}
export class DehydratedDevice {}
export class DehydratedDeviceKey {}
export class DehydratedDevices {}
export class Device {}
export class DeviceId {}
export class DeviceKey {}
export class DeviceKeyAlgorithm {}
export class DeviceKeyId {}
export class DeviceLists {}
export class Ecies {}
export class Ed25519PublicKey {}
export class Ed25519Signature {}
export class Emoji {}
export class EncryptedAttachment {}
export class EncryptionInfo {}
export class EncryptionSettings {}
export class EstablishedEcies {}
export class EventId {}
export class IdentityKeys {}
export class InboundCreationResult {}
export class InboundGroupSession {}
export class InvalidToDeviceEvent {}
export class KeysBackupRequest {}
export class KeysClaimRequest {}
export class KeysQueryRequest {}
export class KeysUploadRequest {}
export class MaybeSignature {}
export class MegolmDecryptionError {}
export class MegolmV1BackupKey {}
export class Migration {}
export class Msc4108IntentData {}
export class Msc4388IntentData {}
export class OlmMachine {}
export class OtherUserIdentity {}
export class OutboundCreationResult {}
export class OwnUserIdentity {}
export class PickledInboundGroupSession {}
export class PickledSession {}
export class PkDecryption {}
export class PkEncryption {}
export class PkMessage {}
export class PlainTextToDeviceEvent {}
export class PutDehydratedDeviceRequest {}
export class Qr {}
export class QrCode {}
export class QrCodeData {}
export class QrCodeIntentData {}
export class QrCodeScan {}
export class RehydratedDevice {}
export class RoomId {}
export class RoomKeyCounts {}
export class RoomKeyImportResult {}
export class RoomKeyInfo {}
export class RoomKeyWithheldInfo {}
export class RoomMessageRequest {}
export class RoomPendingKeyBundleDetails {}
export class RoomSettings {}
export class Sas {}
export class SecretsBundle {}
export class ServerName {}
export class ShieldState {}
export class Signature {}
export class SignatureUploadRequest {}
export class SignatureVerification {}
export class Signatures {}
export class StoreHandle {}
export class StoredRoomKeyBundleData {}
export class ToDeviceEncryptionInfo {}
export class ToDeviceRequest {}
export class ToDeviceUnableToDecryptInfo {}
export class Tracing {}
export class UTDToDeviceEvent {}
export class UploadSigningKeysRequest {}
export class UserDevices {}
export class UserId {}
export class VerificationRequest {}
export class Versions {}

export const DecryptionErrorCode = Object.freeze({});
export const DeviceKeyAlgorithmName = Object.freeze({});
export const DeviceKeyName = Object.freeze({});
export const EncryptionAlgorithm = Object.freeze({});
export const HistoryVisibility = Object.freeze({});
export const LocalTrust = Object.freeze({});
export const LoggerLevel = Object.freeze({});
export const ProcessedToDeviceEventType = Object.freeze({});
export const QrCodeIntent = Object.freeze({});
export const QrState = Object.freeze({});
export const RequestType = Object.freeze({});
export const ShieldColor = Object.freeze({});
export const ShieldStateCode = Object.freeze({});
export const SignatureState = Object.freeze({});
export const ToDeviceUnableToDecryptReason = Object.freeze({});
export const TrustRequirement = Object.freeze({});
export const VerificationMethod = Object.freeze({});
export const VerificationRequestPhase = Object.freeze({});

export default {
  initAsync,
  OlmMachine,
  StoreHandle,
  UserId,
  RoomId,
  SignatureVerification,
  EncryptionAlgorithm,
  HistoryVisibility,
  QrCodeIntent,
  QrState,
};
