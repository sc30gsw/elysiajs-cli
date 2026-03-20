export interface PackageJsonVersion {
  version: string;
}

export function isPackageJsonWithVersion(value: unknown): value is PackageJsonVersion {
  if (typeof value !== "object" || value === null) return false;
  return "version" in value && typeof (value as { version: unknown }).version === "string";
}
