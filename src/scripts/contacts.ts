// Contacts form. The site is static, so there are two ways to actually deliver a mail:
//   1. PUBLIC_CONTACT_ENDPOINT is set at build time → JSON POST to that mail relay
//      (Formspree/Web3Forms/Basin all accept this shape), handled in place.
//   2. no endpoint → open a blank message to the address in the visitor's own mail
//      client via a bare `mailto:` link; they write it themselves.
// Lifecycle-safe for View-Transition navigation.

let cleanup: Array<() => void> = [];

function init(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector<HTMLElement>('[data-contact-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const { endpoint = '', to = '' } = form.dataset;

  const say = (text: string, state: 'idle' | 'error' = 'idle'): void => {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
  };

  const onSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (form.dataset.busy || !form.reportValidity()) return;

    const data = new FormData(form);
    if (data.get('_gotcha')) return; // bot

    if (!endpoint) {
      say(form.dataset.fallback ?? '');
      window.location.href = `mailto:${to}`;
      return;
    }

    const name = String(data.get('name') ?? '');
    const email = String(data.get('email') ?? '');
    const message = String(data.get('message') ?? '');

    form.dataset.busy = 'true';
    if (button) button.disabled = true;
    say(form.dataset.sending ?? '');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      say(form.dataset.sent ?? '');
    } catch {
      say(form.dataset.error ?? '', 'error');
    } finally {
      delete form.dataset.busy;
      if (button) button.disabled = false;
    }
  };

  form.addEventListener('submit', onSubmit);
  cleanup.push(() => form.removeEventListener('submit', onSubmit));
}

function teardown(): void {
  for (const off of cleanup) off();
  cleanup = [];
}

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', teardown);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
    document.removeEventListener('astro:page-load', init);
    document.removeEventListener('astro:before-swap', teardown);
  });
}
