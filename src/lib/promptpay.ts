// PromptPay QR payload (EMVCo TLV + CRC16-CCITT), Thai standard.
// Produces the string that a PromptPay QR code encodes. Render the QR with `qrcode`.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

export function crc16(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Build a PromptPay payload.
 * @param receiverId 13-digit phone or national ID (digits only).
 * @param amount optional fixed amount (baht).
 */
export function buildPromptPayPayload(receiverId: string, amount?: number): string {
  const id = receiverId.replace(/\D/g, "");
  if (id.length !== 13) {
    throw new Error("PromptPay receiver ID must be 13 digits (phone or national ID)");
  }

  const merchantAccount = tlv("00", "A000000677010111") + tlv("02", id);
  const amountStr = amount != null ? tlv("54", amount.toFixed(2)) : "";

  const body =
    tlv("00", "01") + // payload format
    tlv("01", "11") + // point of initiation: static
    tlv("29", merchantAccount) +
    tlv("53", "764") + // THB
    tlv("58", "TH") + // country
    amountStr;

  const withCrcPlaceholder = body + "6304";
  const crc = crc16(withCrcPlaceholder)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");

  return body + "63" + "04" + crc;
}
