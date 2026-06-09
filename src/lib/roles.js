export function roleLabel(role) {
    if (role === 'confirmation') return 'Confirmator';
    if (role === 'call_center_admin') return 'Call center admin';
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
}
