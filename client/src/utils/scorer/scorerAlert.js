import Swal from 'sweetalert2';

// Keep SweetAlert's helpers while bypassing the global substring translator for
// copy already localized by the scorer. This also protects interpolated names.
const scorerAlert = Object.create(Swal);
scorerAlert.fire = (...args) => {
    const options = args.length === 1 && typeof args[0] === 'object'
        ? { ...args[0] }
        : { title: args[0], text: args[1], icon: args[2] };
    return Swal.fire({
        ...options,
        uiTextLocalized: true,
    });
};

export default scorerAlert;
