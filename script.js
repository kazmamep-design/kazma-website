const savedLanguage = localStorage.getItem('kazmaLanguage') || 'ka';
const body = document.body;

function setLanguage(language) {
  if (language === 'en') {
    body.classList.add('lang-en');
    document.documentElement.setAttribute('lang', 'en');
  } else {
    body.classList.remove('lang-en');
    document.documentElement.setAttribute('lang', 'ka');
  }
  localStorage.setItem('kazmaLanguage', language);
}

setLanguage(savedLanguage);

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

const menuButton = document.querySelector('.menu-btn');
const navigation = document.querySelector('.nav');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    navigation.classList.toggle('open');
    const expanded = navigation.classList.contains('open');
    menuButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
}

document.querySelectorAll('.nav a').forEach((link) => {
  link.addEventListener('click', () => navigation?.classList.remove('open'));
});

const yearElement = document.querySelector('[data-year]');
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}
