export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function passwordMeetsRequirements(value: string) {
  const length = Array.from(value).length;
  return length >= 6 && length <= 128;
}
