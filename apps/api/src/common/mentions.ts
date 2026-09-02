export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findMentionedUsers<T extends { id: string; first_name: string; last_name: string }>(
  content: string,
  users: T[],
  exceptId?: string,
): T[] {
  if (!content) return [];
  const lower = content.toLowerCase();
  return users.filter((user) => {
    if (exceptId && user.id === exceptId) return false;
    const needles = [
      `@${user.first_name}`,
      `@${user.first_name}${user.last_name}`,
      `@${user.first_name}.${user.last_name}`,
      `@${user.first_name}_${user.last_name}`,
    ].map((needle) => needle.toLowerCase());
    return needles.some((needle) => new RegExp(`(^|[\\s])${escapeRegExp(needle)}\\b`).test(lower));
  });
}
