// Interactive JavaScript for Vishal Patil's Portfolio

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      mobileToggle.classList.toggle('open');
      
      // Let's toggle menu visualization for mobile in style
      if (navLinks.classList.contains('active')) {
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.width = '100%';
        navLinks.style.background = 'rgba(8, 8, 16, 0.95)';
        navLinks.style.backdropFilter = 'blur(16px)';
        navLinks.style.padding = '24px';
        navLinks.style.borderBottom = '1px solid var(--border-card)';
        navLinks.style.gap = '20px';
      } else {
        navLinks.style.display = '';
      }
    });
  }

  // Smooth Scroll offset for fixed header
  const header = document.querySelector('.header');
  const links = document.querySelectorAll('a[href^="#"]');
  
  links.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
        
        window.scrollTo({
          top: targetPosition - headerHeight - 10,
          behavior: 'smooth'
        });
        
        // Close mobile menu if open
        if (navLinks && navLinks.classList.contains('active')) {
          navLinks.classList.remove('active');
          if (mobileToggle) mobileToggle.classList.remove('open');
          navLinks.style.display = '';
        }
      }
    });
  });

  // Contact Form Submission Simulation
  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  if (contactForm && formStatus) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const submitBtn = contactForm.querySelector('.submit-btn');
      const originalBtnText = submitBtn.innerHTML;
      
      // Visual feedback loading state
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending... <span class="btn-glow"></span>';
      formStatus.textContent = '';
      formStatus.className = 'form-status';
      
      setTimeout(() => {
        // Mock successful submission
        formStatus.textContent = 'Message sent successfully! Thank you for reaching out.';
        formStatus.classList.add('success');
        
        // Reset form
        contactForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        
        // Clear message status after 5s
        setTimeout(() => {
          formStatus.textContent = '';
          formStatus.className = 'form-status';
        }, 5000);
      }, 1500);
    });
  }

  // Decorative element interaction: slight glow movement on mousemove
  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });

  // Log elegant message to console
  console.log('%cDesigned & Developed by Vishal Patil %c— vishal.dev', 'color: #8b5cf6; font-weight: bold; font-size: 14px;', 'color: #06b6d4; font-size: 14px;');
});
