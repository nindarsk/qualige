/**
 * Check if a password has been found in known data breaches
 * using the HaveIBeenPwned k-anonymity API (no API key required).
 * Only the first 5 chars of the SHA-1 hash are sent to the server.
 */
export async function isPasswordLeaked(password: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });

    if (!response.ok) return false; // fail open - don't block registration

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        return true; // password found in breach
      }
    }

    return false;
  } catch {
    return false; // fail open on network errors
  }
}
