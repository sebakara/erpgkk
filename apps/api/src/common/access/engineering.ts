export function isEngineeringDepartment(name?: string | null): boolean {
  if (!name) return false;
  return /r\s*&\s*d|engineering/i.test(name);
}
