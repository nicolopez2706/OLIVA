/* ============================================================
   OLIVA ENSALADAS · Configuración
   Todo lo que cambia seguido (WhatsApp, precios, productos)
   se edita acá, sin tocar el resto del código.
   ============================================================ */

(function () {
  // Opciones de salsitas (se reutilizan en todas las ensaladas).
  // price: lo que SUMA al total. 0 = incluida / sin costo extra.
  var salsitas = function (label) {
    return {
      id: 'salsitas',
      label: label,
      type: 'multi',
      required: false,
      options: [
        { label: 'Salsita César', short: 'César', price: 0 },
        { label: 'Salsita de palta', short: 'Palta', price: 0, tag: 'Nueva' }
      ]
    };
  };

  window.OLIVA_CONFIG = {
    // Número de WhatsApp con código de país, sin +, sin espacios, sin 0 ni 15.
    // Argentina + Córdoba (351):  54 9 351 XXXXXXX  →  "549351XXXXXXX"
    whatsapp: '5493517556863',

    instagram: 'oliva.ensaladass',

    // Precio de cada ensalada en pesos (número, sin puntos). null = "Consultar precio".
    products: [
      {
        id: 'proteica',
        name: 'Proteica',
        tagline: 'Para los que buscan un extra de energía',
        description: 'Base de lechuga o arroz, palta, pollo o atún, tomate cherry y huevo.',
        image: 'assets/img/proteica.webp',
        alt: 'Ensalada Proteica con palta, pollo, tomate cherry y huevo',
        price: null,
        groups: [
          { id: 'base', label: 'Base', type: 'single', required: true,
            options: [{ label: 'Lechuga' }, { label: 'Arroz' }] },
          { id: 'proteina', label: 'Proteína', type: 'single', required: true,
            options: [{ label: 'Pollo' }, { label: 'Atún' }] },
          salsitas('Sumá una salsita')
        ]
      },
      {
        id: 'cesar',
        name: 'César',
        tagline: 'Pollo, parmesano, crutones y nuestra salsa César',
        description: 'Base de lechuga, pollo, rúcula, queso, crutones y salsa César.',
        image: 'assets/img/cesar.webp',
        alt: 'Ensalada César con pollo, queso rallado, crutones y salsa César',
        price: null,
        groups: [
          salsitas('Sumá otra salsita')
        ]
      },
      {
        id: 'vegetariana',
        name: 'Vegetariana',
        tagline: 'Colorida, fresca y sin carne',
        description: 'Base de lechuga o arroz, tomate cherry, choclo, zanahoria y huevo.',
        image: 'assets/img/vegetariana.webp',
        alt: 'Ensalada Vegetariana con zanahoria, choclo, tomate cherry y huevo',
        price: null,
        groups: [
          { id: 'base', label: 'Base', type: 'single', required: true,
            options: [{ label: 'Lechuga' }, { label: 'Arroz' }] },
          salsitas('Sumá una salsita')
        ]
      }
    ]
  };
})();
