// Entry, not authentication: anything typed is discarded and the workspace opens.
(function () {
  var form = document.getElementById('signin-form') || document.getElementById('create-form');
  if (!form) return;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    window.location.href = './index.html';
  });
})();
