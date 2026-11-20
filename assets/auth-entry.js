// Entry, not authentication: anything typed is discarded and the workspace opens.
// Native validation runs before submit, so the workspace opens only once every required field is complete.
(function () {
  var form = document.getElementById('signin-form') || document.getElementById('create-form');
  if (!form) return;
  var password = form.elements.password;
  var confirm = form.elements.confirm;
  function checkMatch() {
    if (confirm) confirm.setCustomValidity(password.value === confirm.value ? '' : 'Passwords do not match.');
  }
  if (confirm) {
    password.addEventListener('input', checkMatch);
    confirm.addEventListener('input', checkMatch);
    checkMatch();
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    window.location.href = './index.html';
  });
})();
