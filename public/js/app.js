// Advanced Theme Toggle with Animations
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.createElement('button');
  themeToggle.className = 'theme-toggle';
  themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  document.body.appendChild(themeToggle);

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    themeToggle.innerHTML = document.body.classList.contains('dark') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    showNotification('Theme switched!');
  });

  // Toast Notifications with Animation
  function showNotification(message) {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    notif.style.position = 'fixed';
    notif.style.top = '20px';
    notif.style.right = '20px';
    notif.style.background = 'linear-gradient(45deg, #ff69b4, #00ced1)';
    notif.style.color = 'white';
    notif.style.padding = '20px';
    notif.style.borderRadius = '15px';
    notif.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    notif.style.animation = 'fadeInUp 0.5s';
    notif.style.zIndex = '1000';
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
  }

  // Progress Bar for Page Load
  const progressBar = document.createElement('div');
  progressBar.className = 'progress';
  progressBar.innerHTML = '<div class="progress-bar" id="progressBar"></div>';
  document.body.insertBefore(progressBar, document.body.firstChild);

  window.addEventListener('load', () => {
    const bar = document.getElementById('progressBar');
    bar.style.width = '100%';
    setTimeout(() => progressBar.remove(), 3000);
  });

  // Modal for Forms
  function createModal(content) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2000';
    modal.innerHTML = `<div class="card" style="max-width: 500px;">${content}<button onclick="this.parentElement.parentElement.remove()" style="margin-top: 20px;">Close</button></div>`;
    document.body.appendChild(modal);
  }

  // Example: Show modal on button click (can be added to forms)
  showNotification('Welcome to Shadowcore!');
});
