/* =========================================================================
   Kaymak — интерактив
   Хедер, мобильное меню, подсветка раздела, появление при прокрутке,
   фильтр портфолио, просмотр фото, форма заявки, карта по клику.
   ========================================================================= */

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const NBSP = ' ';

  /* ---------- Хедер: фон после начала прокрутки, кнопка — после hero ---------- */

  function initHeader() {
    const header = $('[data-header]');
    const hero = $('.hero');
    if (!header) return;

    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!hero || !('IntersectionObserver' in window)) {
      header.classList.add('is-past-hero');
      return;
    }
    const cta = $('.hero__cta', hero);
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-past-hero', !entry.isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(cta || hero);
  }

  /* ---------- Подсветка текущего раздела в меню ---------- */

  function initScrollSpy() {
    const links = $$('.nav__link, .menu__link');
    const sections = [...new Set(links.map((link) => link.hash))]
      .map((hash) => document.getElementById(hash.slice(1)))
      .filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const inView = new Map();
    const setCurrent = (id) => {
      links.forEach((link) => {
        if (link.hash === `#${id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };

    // Узкая полоса посередине экрана: раздел, который её пересекает, и есть текущий
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => inView.set(entry.target.id, entry.isIntersecting));
      const current = sections.find((section) => inView.get(section.id));
      setCurrent(current ? current.id : null);
    }, { rootMargin: '-45% 0px -54% 0px' });

    sections.forEach((section) => observer.observe(section));
  }

  /* ---------- Мобильное меню ---------- */

  function initMenu() {
    const dialog = $('[data-menu]');
    const openButton = $('[data-menu-open]');
    if (!dialog || !openButton || typeof dialog.showModal !== 'function') return;

    const close = () => dialog.close();

    openButton.addEventListener('click', () => {
      dialog.showModal();
      openButton.setAttribute('aria-expanded', 'true');
    });
    dialog.addEventListener('close', () => openButton.setAttribute('aria-expanded', 'false'));
    $('[data-menu-close]', dialog).addEventListener('click', close);

    // Сначала закрываем меню, потом плавно едем к разделу
    $$('[data-menu-link]', dialog).forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = document.getElementById(link.hash.slice(1));
        if (!target) return;
        event.preventDefault();
        close();
        target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
        history.pushState(null, '', link.hash);
      });
    });

    window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches && dialog.open) close();
    });
  }

  /* ---------- Появление при прокрутке ---------- */

  function initReveal() {
    const items = $$('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    items.forEach((item) => observer.observe(item));
  }

  /* ---------- Портфолио: фильтр по категориям ---------- */

  function initWorksFilter() {
    const grid = $('[data-works]');
    if (!grid) return;

    const items = $$('.work', grid);
    const buttons = $$('[data-filter]');
    const empty = $('[data-works-empty]');

    // Имена нужны View Transitions API, чтобы карточки плавно переезжали на новые места
    items.forEach((item, index) => { item.style.viewTransitionName = `work-${index + 1}`; });

    const apply = (filter) => {
      let shown = 0;
      items.forEach((item) => {
        const match = filter === 'all' || item.dataset.category === filter;
        item.hidden = !match;
        if (match) {
          shown += 1;
          item.classList.add('is-visible');
        }
      });
      grid.classList.toggle('is-filtered', filter !== 'all');
      if (empty) empty.hidden = shown > 0;
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-pressed') === 'true') return;
        buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));

        const filter = button.dataset.filter;
        if (document.startViewTransition && !reducedMotion.matches) {
          document.startViewTransition(() => apply(filter));
        } else {
          apply(filter);
        }
      });
    });
  }

  /* ---------- Просмотр фото ---------- */

  function initLightbox() {
    const dialog = $('[data-lightbox]');
    const grid = $('[data-works]');
    if (!dialog || !grid || typeof dialog.showModal !== 'function') return;

    const image = $('[data-lightbox-img]', dialog);
    const title = $('[data-lightbox-title]', dialog);
    const meta = $('[data-lightbox-meta]', dialog);
    const count = $('[data-lightbox-count]', dialog);
    const prev = $('[data-lightbox-prev]', dialog);
    const next = $('[data-lightbox-next]', dialog);
    let links = [];
    let index = 0;

    const show = (newIndex) => {
      index = (newIndex + links.length) % links.length;
      const link = links[index];
      const thumb = $('img', link);

      // Сразу показываем уже загруженное превью, крупное фото подменяем, когда догрузится
      image.src = thumb.currentSrc || thumb.src;
      image.alt = thumb.alt;
      image.classList.add('is-loading');
      const full = new Image();
      full.onload = () => {
        if (links[index] !== link) return;
        image.src = full.src;
        image.classList.remove('is-loading');
      };
      full.onerror = () => image.classList.remove('is-loading');
      full.src = link.href;

      title.textContent = $('.work__title', link).textContent;
      meta.textContent = $('.work__meta', link).textContent;
      count.textContent = `${index + 1} из ${links.length}`;
    };

    grid.addEventListener('click', (event) => {
      const link = event.target.closest('.work__link');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      links = $$('.work:not([hidden]) .work__link', grid);
      prev.hidden = next.hidden = links.length < 2;
      show(links.indexOf(link));
      dialog.showModal();
    });

    $('[data-lightbox-close]', dialog).addEventListener('click', () => dialog.close());
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
    });

    // Клик мимо фото закрывает просмотр
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.classList.contains('lightbox__stage')) dialog.close();
    });

    // Свайп на телефоне
    let startX = null;
    dialog.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse') startX = event.clientX;
    });
    dialog.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const delta = event.clientX - startX;
      startX = null;
      if (Math.abs(delta) > 48 && links.length > 1) show(index + (delta < 0 ? 1 : -1));
    });

    dialog.addEventListener('close', () => {
      image.removeAttribute('src');
      image.classList.remove('is-loading');
    });
  }

  /* ---------- Форма заявки ---------- */

  // Сюда подключается настоящая отправка: Formspree, Telegram-бот или свой сервер. Например:
  // return fetch('https://formspree.io/f/ВАШ_ID', {
  //   method: 'POST',
  //   headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  //   body: JSON.stringify(data),
  // }).then((response) => { if (!response.ok) throw new Error(response.status); });
  function sendOrder(data) {
    return new Promise((resolve) => setTimeout(() => resolve(data), 1200));
  }

  function initOrderForm() {
    const form = $('[data-order-form]');
    const success = $('[data-order-success]');
    if (!form || !success) return;

    const MIN_DAYS = 3;
    const MAX_DAYS = 365;
    const FIELDS = ['name', 'phone', 'date', 'dessert'];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };
    const toISO = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const parseISO = (value) => {
      const [year, month, day] = value.split('-').map(Number);
      return year ? new Date(year, month - 1, day) : null;
    };

    const minDate = addDays(today, MIN_DAYS);
    const maxDate = addDays(today, MAX_DAYS);
    const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
    const weekdayDayMonth = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    const earliest = dayMonth.format(minDate).replace(' ', NBSP);

    form.elements.date.min = toISO(minDate);
    form.elements.date.max = toISO(maxDate);
    const dateHint = $('[data-date-hint]', form);
    if (dateHint) dateHint.textContent = `Не${NBSP}раньше ${earliest}: нужно время, чтобы всё приготовить.`;

    // Тексты ошибок объясняют, как исправить, а не просто «неверно»
    const rules = {
      name(value) {
        const name = value.trim();
        if (!name) return `Напишите, как к${NBSP}вам обращаться.`;
        if (name.length < 2) return `Имя слишком короткое: нужно хотя бы 2${NBSP}буквы.`;
        if (!/^[\p{L}\s'’.-]+$/u.test(name)) return `В${NBSP}имени могут быть только буквы, пробел и${NBSP}дефис.`;
        return '';
      },
      phone(value) {
        const phone = value.trim();
        const digits = phone.replace(/\D/g, '');
        if (!phone) return `Укажите телефон, чтобы я${NBSP}могла с${NBSP}вами связаться.`;
        if (/[^\d\s()+.-]/.test(phone) || digits.length < 9 || digits.length > 15) {
          return `Проверьте номер: нужно от${NBSP}9 до${NBSP}15 цифр, например +34${NBSP}612${NBSP}345${NBSP}678.`;
        }
        return '';
      },
      date(value) {
        if (!value) return `Выберите дату праздника.`;
        const date = parseISO(value);
        if (!date || Number.isNaN(date.getTime())) return `Укажите дату в${NBSP}формате дд.мм.гггг.`;
        if (date < minDate) return `Самая ранняя дата — ${earliest}: торту нужно время.`;
        if (date > maxDate) return `Заказы принимаю не${NBSP}дальше чем на${NBSP}год вперёд.`;
        return '';
      },
      dessert(value) {
        return value ? '' : `Выберите, что готовим.`;
      },
    };

    const fieldOf = (name) => $(`[data-field="${name}"]`, form);

    const setError = (name, message) => {
      const field = fieldOf(name);
      field.classList.toggle('is-invalid', Boolean(message));
      $('.field__error', field).textContent = message;
      const controls = name === 'dessert' ? $$('input', field) : [form.elements[name]];
      controls.forEach((control) => {
        if (message) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      });
    };

    const validate = (name) => {
      const message = rules[name](form.elements[name].value);
      setError(name, message);
      return !message;
    };

    // Не ругаемся, пока человек печатает впервые; после ошибки — перепроверяем на лету
    const touched = new Set();
    ['name', 'phone', 'date'].forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('blur', () => {
        if (!input.value.trim()) return;
        touched.add(name);
        validate(name);
      });
      input.addEventListener('input', () => {
        if (touched.has(name) || fieldOf(name).classList.contains('is-invalid')) validate(name);
      });
    });
    form.addEventListener('change', (event) => {
      if (event.target.name === 'dessert') validate('dessert');
    });

    const submit = $('[type="submit"]', form);
    const submitLabel = $('[data-submit-label]', form);
    const formError = $('[data-form-error]', form);

    const setLoading = (loading) => {
      submit.disabled = loading;
      submit.classList.toggle('is-loading', loading);
      submit.setAttribute('aria-busy', String(loading));
      submitLabel.textContent = loading ? 'Отправляем…' : 'Отправить заявку';
    };

    const slot = (name) => $(`[data-slot="${name}"]`, success);

    const showSuccess = (data) => {
      const date = parseISO(data.date);
      const year = date.getFullYear() !== today.getFullYear() ? ` ${date.getFullYear()}${NBSP}года` : '';

      slot('name').textContent = data.name.split(/\s+/)[0];
      slot('phone').textContent = data.phone;
      slot('dessert').textContent = data.dessert;
      slot('date').textContent = weekdayDayMonth.format(date) + year;
      slot('comment').textContent = data.comment;
      $('[data-slot-row="comment"]', success).hidden = !data.comment;
      slot('number').textContent = `Заявка №${NBSP}K-${String(Date.now()).slice(-4)}`;

      form.hidden = true;
      success.hidden = false;
      success.classList.remove('is-entering');
      void success.offsetWidth;
      success.classList.add('is-entering');

      const card = success.closest('.order-card');
      if (card.getBoundingClientRect().top < 0) {
        card.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      }
      $('[data-success-title]', success).focus({ preventScroll: true });
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.hidden = true;

      const results = FIELDS.map(validate);
      const firstInvalid = FIELDS.find((name, i) => !results[i]);
      if (firstInvalid) {
        FIELDS.forEach((name) => touched.add(name));
        const control = firstInvalid === 'dessert' ? $('input[name="dessert"]', form) : form.elements[firstInvalid];
        control.focus();
        return;
      }

      const data = Object.fromEntries(
        [...new FormData(form)].map(([key, value]) => [key, String(value).trim().replace(/\s+/g, ' ')]),
      );
      data.comment = String(form.elements.comment.value).trim();

      setLoading(true);
      try {
        await sendOrder(data);
        showSuccess(data);
      } catch (error) {
        formError.textContent = `Не${NBSP}получилось отправить заявку. Проверьте интернет и${NBSP}попробуйте ещё раз или напишите мне в${NBSP}WhatsApp.`;
        formError.hidden = false;
      } finally {
        setLoading(false);
      }
    });

    $('[data-order-reset]', success).addEventListener('click', () => {
      form.reset();
      touched.clear();
      FIELDS.forEach((name) => setError(name, ''));
      success.hidden = true;
      success.classList.remove('is-entering');
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------- Карта: грузим OpenStreetMap только по просьбе ---------- */

  function initMap() {
    const map = $('[data-map]');
    const button = $('[data-map-load]');
    if (!map || !button) return;

    button.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.title = 'Карта: Carrer de Sant Vicent, 58, Alicante';
      iframe.src = 'https://www.openstreetmap.org/export/embed.html'
        + '?bbox=-0.4966%2C38.3431%2C-0.4786%2C38.3521&layer=mapnik&marker=38.3476%2C-0.4876';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.addEventListener('load', () => map.classList.add('is-loaded'), { once: true });
      map.append(iframe);
      button.disabled = true;
      button.textContent = 'Загружаем карту…';
      iframe.focus({ preventScroll: true });
    });
  }

  /* ---------- Заглушка, если фото не загрузилось ---------- */

  function initImageFallbacks() {
    const markBroken = (img) => {
      const frame = img.closest('.work__media, .arch, .hero__media');
      if (frame) frame.classList.add('is-broken');
    };
    $$('main img').forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) markBroken(img);
      img.addEventListener('error', () => markBroken(img), { once: true });
    });
  }

  /* ---------- Запуск ---------- */

  window.kaymakReady = true;
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  initHeader();
  initScrollSpy();
  initMenu();
  initReveal();
  initWorksFilter();
  initLightbox();
  initOrderForm();
  initMap();
  initImageFallbacks();
})();
