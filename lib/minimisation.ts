// Known identity masking is deterministic; unknown residual identity still needs human inspection.
export function minimise(text: string, knownNames: string[] = []) {
  let result = text.normalize("NFKC");
  for (const name of knownNames
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    result = result.replace(
      new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      "[NAME]",
    );
  return result
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .replace(/(?:\+44\s?\(?0?\)?|\b0)(?:[\s().-]*\d){9,10}\b/g, "[PHONE]")
    .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "[POSTCODE]")
    .replace(
      /^(?:name|address|date of birth|dob|gender|nationality|marital status)\s*:.*$/gim,
      "[IDENTITY FIELD]",
    );
}
