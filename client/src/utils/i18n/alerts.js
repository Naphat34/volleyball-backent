import Swal from 'sweetalert2';
import { localizeAlertText } from './alertLocale.js';
import { readLanguage } from './language.js';

let confirmationPending = false;

export async function confirmAction(message, parentDialog) {
  if (confirmationPending) return false;
  confirmationPending = true;
  const thai = readLanguage() === 'THA';
  let host;
  let previousFocus;

  try {
    // A dialog opened with showModal() sits above SweetAlert's normal body target.
    if (parentDialog?.open) {
      previousFocus = document.activeElement;
      host = document.createElement('dialog');
      host.setAttribute('aria-label', thai ? 'ยืนยันการดำเนินการ' : 'Confirm action');
      host.style.cssText = 'inset:0; margin:0; padding:0; width:100%; height:100%; max-width:none; max-height:none; border:0; background:transparent;';
      host.addEventListener('cancel', event => event.preventDefault());
      document.body.append(host);
      host.showModal();
    }

    const result = await Swal.fire({
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: thai ? 'ยืนยัน' : 'Confirm',
      cancelButtonText: thai ? 'ยกเลิก' : 'Cancel',
      focusConfirm: false,
      focusCancel: true,
      keydownListenerCapture: true,
      uiTextLocalized: true,
      ...(host && { target: host, returnFocus: false, showClass: { popup: '' }, hideClass: { popup: '' } }),
    });
    return result.isConfirmed;
  } finally {
    if (host) {
      host.close();
      host.remove();
      previousFocus?.focus();
    }
    confirmationPending = false;
  }
}

export function showNotice(message, icon, { acknowledge = false } = {}) {
  return Swal.fire({
    text: localizeAlertText(message),
    icon,
    uiTextLocalized: true,
    ...(acknowledge && {
      confirmButtonText: readLanguage() === 'THA' ? 'ตกลง' : 'OK',
      allowOutsideClick: false,
    }),
  });
}
