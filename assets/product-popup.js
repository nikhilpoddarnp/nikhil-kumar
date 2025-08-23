(() => {
  const money = (cents) => {
    const currency =
      (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD";
    try {
      return (cents / 100).toLocaleString(undefined, {
        style: "currency",
        currency,
      });
    } catch {
      return `${(cents / 100).toFixed(2)} ${currency}`;
    }
  };

  function ensurePopup() {
    let popup = document.getElementById("product-popup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "product-popup";
      popup.className = "popup hidden";
      popup.innerHTML = `
        <div class="popup-content">
          <button class="popup-close" aria-label="Close">×</button>
          <div id="popup-content-inner"></div>
        </div>
      `;
      document.body.appendChild(popup);
    }

    // Bind close events
    const closeBtn = popup.querySelector(".popup-close");
    if (closeBtn) {
      closeBtn.onclick = () => popup.classList.add("hidden");
    }

    popup.onclick = (e) => {
      if (e.target === popup) popup.classList.add("hidden");
    };

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") popup.classList.add("hidden");
    });

    return popup;
  }

  async function openProduct(handle) {
    if (!handle) {
      console.warn("No product handle on card");
      return;
    }

    const popup = ensurePopup();
    const inner = popup.querySelector("#popup-content-inner");

    inner.innerHTML = '<div class="popup-loading">Loading…</div>';
    popup.classList.remove("hidden");

    try {
      const res = await fetch(`/products/${handle}.js`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const product = await res.json();

      const firstImg = (product.images && product.images[0]) || "";
      const priceText = money(product.price);
      const desc = product.description || "";

      // Get options
      const colorOption = product.options.find(
        (o) => o.name.toLowerCase() === "color"
      );
      const sizeOption = product.options.find(
        (o) => o.name.toLowerCase() === "size"
      );

      const variantColorOptions = colorOption ? colorOption.values : [];
      const variantSizeOptions = sizeOption ? sizeOption.values : [];

      // Default variant (first one)
      let selectedColor = variantColorOptions[0] || "";
      let selectedSize = variantSizeOptions[0] || "";
      let currentVariant = product.variants[0];

      inner.innerHTML = `
        <div class="popup-product">
          <div class="popup-left">
            ${
              firstImg
                ? `<img src="${firstImg}" alt="${product.title}" width="120" height="140">`
                : ""
            }
          </div>
          <div class="popup-right">
            <h3 class="popup-title">${product.title}</h3>
            <div class="popup-price">${priceText}</div>
            <div class="popup-desc">${desc}</div>
          </div>
        </div>

        <div class="popup-form-container">
          <form method="post" action="/cart/add" class="popup-form">
            <input type="hidden" name="id" id="variant-id" value="${
              currentVariant.id
            }">
            <label>
                Color
<div class="popup-color-options">
            ${variantColorOptions
              .map(
                (color, idx) => `
  <button type="button" 
    class="popup-color-option ${idx === 0 ? "active" : ""}" 
    data-color="${color}">
    <span class="color-swatch" style="background-color:${color}"></span>
    ${color}
  </button>
`
              )
              .join("")}
  </div>
  </label>


            ${
              variantSizeOptions.length > 0
                ? `
              <label>
                Size
                <select id="popup-size">
                <option value="" selected>Choose your size</option>
                  ${variantSizeOptions
                    .map(
                      (v, idx) => `
                    <option value="${v}">${v}</option>
                  `
                    )
                    .join("")}
                </select>
              </label>
            `
                : ""
            }

            <button type="submit" class="popup-add">ADD TO CART →</button>
          </form>
        </div>
      `;

      // Now bind events
      const form = inner.querySelector(".popup-form");
      const hiddenInput = inner.querySelector("#variant-id");
      const colorButtons = inner.querySelectorAll(".popup-color-option");
      const sizeSelect = inner.querySelector("#popup-size");

      function updateVariantId() {
        const match = product.variants.find(
          (v) =>
            (!selectedColor ||
              v.option1 === selectedColor ||
              v.option2 === selectedColor) &&
            (!selectedSize ||
              v.option1 === selectedSize ||
              v.option2 === selectedSize)
        );
        if (match) {
          hiddenInput.value = match.id;
          currentVariant = match;
        }
      }

      // Color toggle
      colorButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          colorButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          selectedColor = btn.dataset.color;
          updateVariantId();
        });
      });

      // Size change
      if (sizeSelect) {
        sizeSelect.addEventListener("change", (e) => {
          selectedSize = e.target.value;
          updateVariantId();
        });
      }

      // Init variant ID
      updateVariantId();
    } catch (err) {
      inner.innerHTML = `<p>Sorry, couldn’t load this product.</p>`;
      console.error("Product load failed:", err);
    }
  }

  function bind(sectionEl) {
    const grid = sectionEl.querySelector(".grid");
    if (!grid) return;

    grid.addEventListener(
      "click",
      (e) => {
        const card = e.target.closest(".product-card");
        if (!card) return;
        const handle =
          card.dataset.handle ||
          card.getAttribute("data-handle") ||
          card.getAttribute("data-product-handle");
        if (handle) {
          console.log("Opening product:", handle);
          openProduct(handle);
        }
      },
      { passive: true }
    );
  }

  // Initial bind
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".product-grid").forEach(bind);
  });

  // Re-bind in theme editor
  document.addEventListener("shopify:section:load", (e) => {
    const s = e.target.querySelector(".product-grid");
    if (s) bind(s);
  });
})();
