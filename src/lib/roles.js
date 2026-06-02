export function roleLabel(role) {
    if (role === 'confirmation') return 'Confirmator';
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
}
