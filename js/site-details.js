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

  phone: '',                 // e.g. '01225 123456'
  email: '',                 // e.g. 'hello@smoovecafe.co.uk'
  instagram: 'smoovecafe',   // just the name, without the @
  justEat: '',               // paste your full Just Eat page link here, starting https://

  // Logo images (optional). Put the files in assets/images/ and type their names here.
  // Leave as '' to use the text logo.
  logoOnBurgundy: '',        // cream logo, e.g. 'assets/images/logo-cream.png'
  logoOnCream: '',           // burgundy logo, e.g. 'assets/images/logo-burgundy.png'

  // Photos (optional). Put the files in assets/images/ and type their names here.
  // Leave as '' to show a plain branded panel instead.
  photos: {
    hero: { file: '', alt: 'An açaí bowl held in hand at Smoove Cafe' },
    bowls: { file: '', alt: 'Açaí bowls topped with fruit and Smoove granola' },
    bagels: { file: '', alt: 'A toasted bagel stacked with fillings' },
    drinks: { file: '', alt: 'Iced matcha and smoothies on the counter' },
    space: { file: '', alt: 'Inside Smoove Cafe: warm wood, plants and a dog by the table' }
  },

  // The web address of your Google Apps Script booking system (see README, step 4).
  // While this is '', the Book page asks people to message you instead.
  bookingApiUrl: ''
};
