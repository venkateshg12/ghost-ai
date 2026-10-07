export const omitPassword = <T extends { passwordHash: string | null }>(user: T) => {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
};
