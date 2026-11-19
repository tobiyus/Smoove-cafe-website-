/*
 * SMOOVE CAFE – YOUR DETAILS (edit me!)
 * ---------------------------------------------------------------
 * Address, opening hours, contact details and links live here, and every
 * page of the website reads them from this one file.
 *
 * How to edit: change the text between the quote marks '...'.
 * Keep the quote marks and the comma at the end of each line.
 * Leave something as '' (two quote marks, nothing between) to hide it.
 */
window.SMOOVE = {
  name: 'Smoove Cafe',
  slogan: 'stay a little longer.',

  address: {
    building: 'Inside City Fitness gym hub',
    street: '69 Roundpond',
    town: 'Melksham',
    county: 'Wiltshire',
    postcode: 'SN12 8EB'
  },
  // What Google Maps should search for when someone taps "Open in Maps".
  mapSearch: 'City Fitness, 69 Roundpond, Melksham SN12 8EB',

  // Opening hours, shown on every page. Add or remove lines as you like.
  hours: [
    { days: 'Tuesday – Saturday', times: '9:30am – 2:30pm' },
    { days: 'Sunday & Monday', times: 'Closed' }
  ],

  phone: '07346 810711',                 // e.g. '01225 123456'
  email: 'smoove.melksham@gmail.com',                 // e.g. 'hello@smoovecafe.co.uk'
  instagram: 'smoovecafe',   // just the name, without the @
  justEat: 'https://www.just-eat.co.uk/restaurants-smoove-challymead/menu',               // paste your full Just Eat page link here, starting https://

  // Logo images (optional). Put the files in assets/images/ and type their names here.
  // Leave as '' to use the text logo.
  logoOnBurgundy: 'assets/images/logo-cream.png',        // cream logo, e.g. 'assets/images/logo-cream.png'
  logoOnCream: 'assets/images/logo-burgundy.png',           // burgundy logo, e.g. 'assets/images/logo-burgundy.png'

  // Photos (optional). Put the files in assets/images/ and type their names here.
  // Leave as '' to show a plain branded panel instead.
  photos: {
    hero: { file: 'assets/images/acaibowl.jpg', alt: 'An açaí bowl topped with coconut, strawberries and Biscoff crumb, held in two hands' },
    bowls: { file: 'assets/images/bowlsontray.jpg', alt: 'Three pots topped with berries, granola and Biscoff on a black tray' },
    bagels: { file: 'assets/images/bagel.jpg', alt: 'A toasted bagel cut in half and stacked with chicken and salad, in a takeaway box' },
    drinks: { file: 'assets/images/strawberrymatcha.jpeg', alt: 'An iced strawberry matcha in a glass with a glass straw' },
    space: { file: 'assets/images/thespace.jpg', alt: 'Inside Smoove Cafe: burgundy and sage-green walls, wooden tables, green velvet chairs and a cushioned window seat' }
  },

  // The web address of your Google Apps Script booking system (see README, step 4).
  // While this is '', the Book page asks people to message you instead.
  bookingApiUrl: ''
};
