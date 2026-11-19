/*
 * SMOOVE CAFE – MENU (edit me!)
 * ---------------------------------------------------------------
 * The whole menu lives in this one file. The Menu page builds itself from it.
 *
 * Each item looks like this:
 *   { name: 'Latte', price: '£4.00' },
 *   { name: 'Avo Loco', tag: 'VG', description: 'avocado, ...', allergens: 'GL · MU · SE*' },
 *
 * - name         the item's name (required)
 * - tag          optional little label: V, VG, Coming soon, Protein, Collagen...
 * - description  optional ingredients
 * - allergens    optional allergen codes
 * - price        optional; leave it out if the section has one price for everything
 * - extra        optional add-on line, e.g. 'Add coffee +£0.50'
 *
 * Rules to keep the file working:
 *   - Keep the quote marks '...' around words, and a comma after each line and each } .
 *   - If you need an apostrophe inside the words, type \' (e.g. 'Mum\'s favourite').
 *   - Use the · symbol between allergens (copy it from here: · ).
 * After saving, the website updates within a minute or two.
 */
window.SMOOVE_MENU = {
  food: [
    {
      title: 'Bagels',
      price: '£8.25',
      intro: 'All served in a freshly toasted NYC bagel',
      items: [
        { name: 'Hot Honey Halloumi', tag: 'V', description: 'air-fried halloumi, avocado, sweet chilli jam, tomato, romaine lettuce, crispy onions', allergens: 'GL · M · SU · SE*' },
        { name: 'The Smoky One', description: 'chicken breast, mature smoked cheddar, caramelised onion chutney, garlic mayo, romaine lettuce, crispy onions', allergens: 'GL · M · MU · SE*' },
        { name: 'The Pickleback', tag: 'Coming soon', description: 'New York salt beef, melted smoked cheddar, dill pickles, cabbage & carrot slaw, deli sauce, crispy onions', allergens: 'GL · M · MU · SU · SE*' },
        { name: 'Avo Loco', tag: 'VG', description: 'avocado, chipotle vegan mayo, sweetcorn & lime salsa, pickled red onions, romaine lettuce, crispy onions', allergens: 'GL · MU · SE*' }
      ]
    },
    {
      title: 'Banana Bread',
      price: '£7.50',
      intro: 'Served warm',
      notes: ['Banana bread allergens TBC'],
      items: [
        { name: 'Biscoff Cheesecake', description: 'thick Greek yoghurt, Biscoff, strawberries, Biscoff biscuit crumb, honey', allergens: 'GL · M · SO' },
        { name: 'Nutella & Berries', description: 'strawberries, blueberries, sunflower seeds, Nutella, cacao nibs', allergens: 'M · SO · TN' },
        { name: 'Peanut Butter Crunch', description: 'peanut butter, Smoove granola, maple syrup, cinnamon', allergens: 'GL · PN' }
      ]
    },
    {
      title: 'Açaí & Bowls',
      price: '£10.50',
      intro: '12oz, topped with Smoove granola. GF granola on request',
      notes: ['Swap to a Greek yoghurt base £6.50', 'Extra toppings +£0.80'],
      items: [
        { name: 'Build Your Own', description: 'choose any 4 toppings at the till', allergens: 'GL + toppings' },
        { name: 'The Glow Up', description: 'banana, strawberries, blueberries, cacao nibs, raspberry purée', allergens: 'GL' },
        { name: 'Crumb & Coco', description: 'banana, strawberries, coconut, Biscoff spread, Biscoff crumb', allergens: 'GL · SO' },
        { name: 'Midnight Berry', description: 'strawberries, blueberries, chia seeds, Nutella', allergens: 'GL · M · SO · TN' },
        { name: 'Razzle Dazzle', description: 'raspberries, strawberries, roasted hazelnuts, white chocolate hazelnut drizzle', allergens: 'GL · M · SO · TN' }
      ]
    },
    {
      title: 'Overnight Oats',
      price: '£7.95',
      intro: '100% wholegrain rolled oats, chia seeds & oat milk',
      items: [
        { name: 'Maple Morning', description: 'peanut butter, banana, maple syrup, cinnamon, Smoove granola', allergens: 'GL · PN' },
        { name: 'Biscoff Crumble', description: 'Greek yoghurt, banana, Biscoff spread, Biscoff crumb', allergens: 'GL · M · SO' },
        { name: 'Berry Patch', description: 'Greek yoghurt, strawberries, blueberries, sunflower seeds, raspberry purée', allergens: 'GL · M' }
      ]
    }
  ],

  drinks: [
    {
      title: 'Hot',
      items: [
        { name: 'Latte', price: '£4.00' },
        { name: 'Cappuccino', price: '£4.00' },
        { name: 'Flat White', price: '£3.50' },
        { name: 'Americano', price: '£3.20' },
        { name: 'Mocha', description: 'milk or white', price: '£4.40' },
        { name: 'Matcha Latte', price: '£5.00' },
        { name: 'Hot Chocolate', description: 'milk or white', price: '£4.00' }
      ]
    },
    {
      title: 'Iced',
      intro: '16oz, served over ice',
      notes: ['Upgrade to our 20oz XL cup +£1.30'],
      items: [
        { name: 'Iced Latte', price: '£4.20' },
        { name: 'Iced Americano', price: '£3.40' },
        { name: 'Iced Mocha', description: 'milk or white', price: '£4.60' },
        { name: 'Iced Chai Latte', price: '£4.20' },
        { name: 'Iced Banana Bread Latte', price: '£4.80' }
      ]
    },
    {
      title: 'Matcha (Iced)',
      intro: '16oz, picked first in Kagoshima, Japan, whisked by us',
      notes: ['Upgrade to our 20oz XL cup +£1.30'],
      items: [
        { name: 'White Chocolate', price: '£5.50' },
        { name: 'Strawberry', price: '£5.50' },
        { name: 'Honey & Cinnamon', price: '£5.50' },
        { name: 'Banana Bread', price: '£5.50' },
        { name: 'Raspberry & Coconut', price: '£6.00' }
      ]
    },
    {
      title: 'Smoothies',
      price: '£6.75',
      intro: '16oz, blended to order',
      notes: ['Upgrade to our 20oz XL cup +£1.30'],
      items: [
        { name: 'Berry Strong', tag: 'Protein', description: 'strawberries, banana, strawberry protein, oat milk' },
        { name: 'Rise n Shine', tag: 'Protein', description: 'chocolate protein, banana, peanut butter, cacao powder, oat milk', extra: 'Add coffee +£0.50' },
        { name: 'Tropic Glow', tag: 'Collagen', description: 'mango, banana, pineapple collagen, coconut milk, strawberry purée' },
        { name: 'Pink Velvet', description: 'strawberries, banana, almond butter, vanilla, cinnamon, oat milk' }
      ]
    },
    {
      title: 'Extras',
      items: [
        { name: 'Oat or coconut milk', price: '+£0.50' },
        { name: 'Syrup', price: '+£0.40' },
        { name: 'Extra shot', price: '+£0.50' }
      ]
    }
  ],

  // Dietary key, shown under the menu.
  key: [
    ['V', 'vegetarian'], ['VG', 'vegan'], ['*', 'may contain'], ['GL', 'gluten'], ['M', 'milk'],
    ['EG', 'egg'], ['SO', 'soya'], ['SE', 'sesame'], ['PN', 'peanuts'], ['TN', 'tree nuts'],
    ['MU', 'mustard'], ['SU', 'sulphites']
  ],

  allergyNote: 'Everything is made in our small, shared kitchen, so we can\'t guarantee any item is free from allergens. Please tell our team about any allergies before you order.',

  loyalty: '8 stamps = your next drink\'s on us. Ask for a card at the till.'
};
