/* TeyVenture itinerary panel
   Each destination page has <div class="pkg-itin" data-dest="liyue">.
   This file holds the day-by-day data and builds the day tabs and stops.

   Stop format: [period, time, name, duration, type, description]
   period: m = morning, a = afternoon, e = evening, n = night
   type:   G guided, M meal included, O meal on your own, T transfer,
           F free time, H hotel, S self-guided
*/
(function () {
  "use strict";

  var PERIOD = { m: "Morning", a: "Afternoon", e: "Evening", n: "Night" };
  var TYPE = {
    G: "Guided", M: "Meal included", O: "Meal on your own", T: "Transfer",
    F: "Free time", H: "Hotel", S: "Self-guided"
  };

  var DATA = {

    mondstadt: [
      { t: "Arrival and Cider Lake", stay: "Mondstadt Grand Hotel", tr: "Private vehicle", ml: "On your own", s: [
        ["m", "10:00", "Airport pickup and welcome", "30 min", "T", "Meet your guide at arrivals and ride to Mondstadt in a private vehicle."],
        ["m", "11:30", "Hotel check-in and bag drop", "45 min", "H", "Settle in at Mondstadt Grand Hotel. Bags are stored if your room isn't ready."],
        ["a", "13:00", "Lunch in the old town", "1 hr", "O", "Pick a cafe or tavern near the plaza. Your guide shares suggestions."],
        ["a", "14:30", "Cider Lake walk", "2 hrs", "G", "Stroll the lakeshore with views of the city and the green hills around it."],
        ["e", "17:30", "Golden hour by the lake", "1 hr", "S", "Free time for photos as the light softens over the water."],
        ["e", "19:00", "Dinner at a local tavern", "1.5 hrs", "O", "Hearty local dishes. Your guide can recommend places for your group."],
        ["n", "20:45", "Lamplit old town walk", "1.5 hrs", "G", "A guided night walk through quiet squares and lamplit stone streets."],
        ["n", "22:15", "Return to the hotel", "15 min", "F", "Walk back or ride the local shuttle."]
      ]},
      { t: "Windrise and the countryside", stay: "Mondstadt Grand Hotel", tr: "Local shuttle", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the hotel", "1 hr", "M", "Start the day with a hearty breakfast before heading out."],
        ["m", "09:00", "Shuttle to Windrise", "40 min", "T", "A scenic ride out of the city and up into the hills."],
        ["m", "10:00", "Windrise windmill hills", "2.5 hrs", "G", "Walk the hilltop paths around the windmills with wide views of the valley."],
        ["a", "12:45", "Lunch at a countryside cafe", "1 hr", "O", "A relaxed stop on your own. Your guide points out good options."],
        ["a", "14:30", "Meadows and old stone paths", "1.5 hrs", "G", "An easy walk through rolling green fields and historic trails."],
        ["a", "16:30", "Return to the city", "45 min", "T", "Shuttle back to Mondstadt."],
        ["e", "18:30", "Dinner in town", "1.5 hrs", "O", "Choose from the city's taverns and restaurants."],
        ["n", "20:30", "Stargazing from the hills", "1.5 hrs", "G", "Clear skies away from the city lights. Your guide points out the constellations."],
        ["n", "22:15", "Return to the hotel", "20 min", "T", "Private vehicle back to the hotel."]
      ]},
      { t: "Grand Cathedral and departure", stay: "Check-out", tr: "Airport drop-off", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the hotel", "1 hr", "M", "Last included meal of the trip."],
        ["m", "09:00", "Check-out and bag storage", "30 min", "H", "Leave your bags at the front desk for the day."],
        ["m", "09:30", "The Grand Cathedral of Mondstadt", "2 hrs", "G", "Visit the cathedral's stained glass and history. Entrance fee is included."],
        ["a", "12:00", "Free time and lunch", "1.5 hrs", "F", "One last browse of shops and cafes. Lunch is on your own."],
        ["a", "14:00", "Airport transfer", "45 min", "T", "Your driver takes you to the airport. Safe travels."]
      ]}
    ],

    liyue: [
      { t: "Arrival at Liyue Harbor", stay: "Liyue Harbor Grand Inn", tr: "Private vehicle", ml: "Welcome dinner", s: [
        ["m", "09:30", "Airport pickup and welcome", "30 min", "T", "Meet your guide at arrivals and head to Liyue Harbor in a private vehicle."],
        ["m", "11:00", "Check-in and bag drop", "45 min", "H", "Settle in at Liyue Harbor Grand Inn. Bags are stored if your room isn't ready."],
        ["a", "12:30", "Lunch by the harbor", "1 hr", "O", "Try local seafood at a harbor-side restaurant. Lunch is on your own."],
        ["a", "14:30", "Liyue Harbor walking tour", "2 hrs", "G", "Walk the docks, markets, and stone streets with stories on the harbor's trading history."],
        ["e", "17:15", "Sunset at the pier", "45 min", "S", "Free time for photos as the harbor lights come on."],
        ["e", "18:30", "Welcome dinner", "1.5 hrs", "M", "A relaxed group dinner at a partner restaurant near the inn."],
        ["n", "20:30", "Lantern walk along the harbor", "1.5 hrs", "G", "See the harbor at its brightest, with lantern-lit streets and rooftop views."],
        ["n", "22:00", "Return to the inn", "15 min", "F", "Walk back or take the vehicle. Rest up for the mountain day."]
      ]},
      { t: "Mt. Aocang and mountain views", stay: "Liyue Harbor Grand Inn", tr: "Mountain shuttle", ml: "Breakfast, lunch", s: [
        ["m", "06:30", "Breakfast at the inn", "45 min", "M", "An early start so you reach the viewpoints before the crowds."],
        ["m", "07:30", "Shuttle to Mt. Aocang", "45 min", "T", "Scenic ride up with a photo stop along the way."],
        ["m", "08:30", "Summit viewpoint trail", "2.5 hrs", "G", "An easy-to-moderate trail with panoramic views of the ranges and valley."],
        ["m", "11:30", "Folklore at the old shrine", "1 hr", "G", "Your guide shares the legends tied to the mountain and its shrine."],
        ["a", "13:00", "Mountain lunch", "1 hr", "M", "A hearty meal at a mountain-side eatery."],
        ["a", "14:30", "Tea terrace and free time", "1.5 hrs", "F", "Rest, take photos, or explore the terrace at your own pace."],
        ["a", "16:30", "Descent and return", "1 hr", "T", "Shuttle back to the harbor."],
        ["e", "18:30", "Dinner in town", "1.5 hrs", "O", "Local dishes at a restaurant with a view of the harbor."],
        ["n", "20:15", "Stargazing at the hilltop deck", "1.5 hrs", "G", "Clear skies and little light. Your guide points out the main constellations."],
        ["n", "22:00", "Return to the inn", "20 min", "T", "Private vehicle back to Liyue Harbor Grand Inn."]
      ]},
      { t: "Wangshu Inn and local culture", stay: "Liyue Harbor Grand Inn", tr: "Private vehicle", ml: "Breakfast, lunch, dinner", s: [
        ["m", "07:30", "Breakfast at the inn", "1 hr", "M", "Take it slow this morning."],
        ["m", "09:00", "Transfer to Wangshu Inn", "40 min", "T", "Drive through the countryside with commentary from your guide."],
        ["m", "10:00", "Wangshu Inn guided visit", "2 hrs", "G", "Tour the inn, its gardens, and the surrounding area."],
        ["a", "12:30", "Local cuisine tasting lunch", "1.5 hrs", "M", "Regional specialties served family-style."],
        ["a", "14:30", "Tea house and traditional crafts", "1.5 hrs", "G", "See how local crafts are made and enjoy a tea service."],
        ["a", "16:30", "Market free time", "1.5 hrs", "F", "Browse the stalls at your own pace. Souvenirs are not included."],
        ["e", "18:30", "Farewell banquet dinner", "2 hrs", "M", "The final group dinner, with a full spread of local favorites."],
        ["n", "21:00", "Night market stroll", "1.5 hrs", "S", "Street snacks, lanterns, and live music. Your guide sets a meeting time and point."],
        ["n", "22:30", "Return to the inn", "15 min", "T", "Private vehicle back to the inn."]
      ]},
      { t: "Free morning and departure", stay: "Check-out", tr: "Airport drop-off", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the inn", "1 hr", "M", "Last included meal of the trip."],
        ["m", "09:00", "Check-out and bag storage", "30 min", "H", "Leave your bags at the front desk while you enjoy the morning."],
        ["m", "09:30", "Free morning at the harbor", "2.5 hrs", "F", "A last walk, photos, or a final cup of tea."],
        ["a", "12:30", "Airport transfer", "45 min", "T", "Your driver takes you to the airport. Lunch is on your own."],
        ["a", "14:00", "Departure", "", "F", "Safe travels. We hope to see you again."]
      ]}
    ],

    inazuma: [
      { t: "Arrival in Inazuma City", stay: "Inazuma City Ryokan", tr: "Private vehicle", ml: "Traditional dinner", s: [
        ["m", "10:00", "Airport pickup and welcome", "30 min", "T", "Meet your guide and ride to Inazuma City in a private vehicle."],
        ["m", "11:30", "Ryokan check-in", "45 min", "H", "Settle into your tatami room. Bags are stored if it isn't ready."],
        ["a", "13:00", "Lunch in the city", "1 hr", "O", "Noodles, skewers, or sweets. Your guide shares favorites."],
        ["a", "14:30", "Inazuma City walking tour", "2 hrs", "G", "Stone lanes, shop fronts, and local stories from your guide."],
        ["e", "17:30", "Tea at the ryokan", "1 hr", "G", "A quiet tea service to ease into the evening."],
        ["e", "19:00", "Traditional welcome dinner", "1.5 hrs", "M", "A multi-dish meal of regional specialties."],
        ["n", "20:45", "Lantern-lit evening stroll", "1.5 hrs", "G", "Walk the old streets as lanterns glow along the waterfront."],
        ["n", "22:15", "Rest at the ryokan", "", "F", "Soak, relax, and prepare for the island crossing."]
      ]},
      { t: "Narukami Island Grand Shrine", stay: "Inazuma City Ryokan", tr: "Ferry and island shuttle", ml: "Breakfast, traditional lunch", s: [
        ["m", "07:00", "Breakfast at the ryokan", "1 hr", "M", "A traditional breakfast before the ferry."],
        ["m", "08:30", "Ferry to Narukami Island", "50 min", "T", "Cross the water with views of the coast."],
        ["m", "09:30", "Narukami Island Grand Shrine", "2.5 hrs", "G", "Walk the shrine grounds under the sakura with your guide."],
        ["a", "12:30", "Traditional lunch on the island", "1.5 hrs", "M", "A local set meal near the shrine."],
        ["a", "14:30", "Island viewpoints and photo stops", "1.5 hrs", "S", "Free time to explore the coast and take photos."],
        ["a", "16:30", "Ferry back to the city", "50 min", "T", "Return across the water at golden hour."],
        ["e", "18:30", "Dinner in town", "1.5 hrs", "O", "Choose from local restaurants near the ryokan."],
        ["n", "20:30", "Seaside stargazing", "1.5 hrs", "G", "A quiet stretch of coast with a wide night sky."],
        ["n", "22:15", "Return to the ryokan", "20 min", "T", "Private vehicle back to your room."]
      ]},
      { t: "Ritou Trading Port and Tenshukaku", stay: "Inazuma City Ryokan", tr: "Private vehicle", ml: "Breakfast, farewell dinner", s: [
        ["m", "07:30", "Breakfast at the ryokan", "1 hr", "M", "Fuel up for a full day of sightseeing."],
        ["m", "09:00", "Transfer to Ritou", "45 min", "T", "Drive to the port with commentary from your guide."],
        ["m", "10:00", "Ritou Trading Port", "2 hrs", "G", "Watch the harbor at work, browse stalls, and hear the port's story."],
        ["a", "12:30", "Seafood lunch at the port", "1.5 hrs", "O", "Fresh catches at a port-side restaurant, on your own."],
        ["a", "14:30", "Tenshukaku", "2 hrs", "G", "Tour the castle grounds and take in the islands from above."],
        ["a", "16:45", "Free time in the castle town", "1 hr", "F", "Shops, snacks, and a last look at the view."],
        ["e", "18:30", "Farewell dinner", "2 hrs", "M", "A multi-course traditional meal for the whole group."],
        ["n", "20:45", "Harbor night market", "1.5 hrs", "S", "Street food, lanterns, and games by the water."],
        ["n", "22:15", "Return to the ryokan", "30 min", "T", "Private vehicle back to your room."]
      ]},
      { t: "Free morning and departure", stay: "Check-out", tr: "Airport drop-off", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the ryokan", "1 hr", "M", "Last included meal of the trip."],
        ["m", "09:00", "Check-out and bag storage", "30 min", "H", "Leave your bags at the front desk."],
        ["m", "09:30", "Free morning in the city", "2.5 hrs", "F", "Last-minute shopping or a final stroll."],
        ["a", "12:30", "Airport transfer", "45 min", "T", "Your driver takes you to the airport. Lunch is on your own."],
        ["a", "14:00", "Departure", "", "F", "Safe travels. We hope to see you again."]
      ]}
    ],

    sumeru: [
      { t: "Arrival and the Akademiya", stay: "Sumeru City Heritage Hotel", tr: "Private vehicle", ml: "Welcome dinner", s: [
        ["m", "10:00", "Airport pickup and welcome", "30 min", "T", "Meet your guide and ride to Sumeru City in a private vehicle."],
        ["m", "11:30", "Hotel check-in and bag drop", "45 min", "H", "Settle in at Sumeru City Heritage Hotel."],
        ["a", "13:00", "Lunch in the city", "1 hr", "O", "Local dishes near the hotel. Your guide shares suggestions."],
        ["a", "14:30", "Sumeru City Akademiya", "2 hrs", "G", "Walk the grounds and halls of the famed academy. Entrance is included."],
        ["e", "17:15", "Courtyards and library views", "45 min", "S", "Free time to explore and take photos."],
        ["e", "18:30", "Welcome dinner", "1.5 hrs", "M", "A group dinner of regional specialties."],
        ["n", "20:30", "City lights walk", "1.5 hrs", "G", "See the city glow after dark with your guide."],
        ["n", "22:00", "Return to the hotel", "15 min", "F", "Rest up for the rainforest."]
      ]},
      { t: "Gandharva Ville and the rainforest", stay: "Sumeru City Heritage Hotel", tr: "Rainforest shuttle", ml: "Breakfast, lunch", s: [
        ["m", "07:00", "Breakfast at the hotel", "1 hr", "M", "An early start for the forest."],
        ["m", "08:00", "Shuttle to the rainforest", "1 hr", "T", "Watch the city give way to dense canopy."],
        ["m", "09:15", "Canopy trail", "2.5 hrs", "G", "Walk among giant trees and hanging vines with a guide who knows the plants."],
        ["a", "12:30", "Lunch in Gandharva Ville", "1.5 hrs", "M", "A local meal in the village."],
        ["a", "14:30", "Gandharva Ville village walk", "2 hrs", "G", "See how the community lives in step with the forest."],
        ["a", "16:45", "Return to the city", "1 hr", "T", "Shuttle back to Sumeru City."],
        ["e", "18:30", "Dinner in town", "1.5 hrs", "O", "Choose from the city's restaurants."],
        ["n", "20:30", "Night market and street food", "1.5 hrs", "S", "Snacks, crafts, and music in the city's evening market."],
        ["n", "22:00", "Return to the hotel", "15 min", "F", "A short walk or ride back."]
      ]},
      { t: "The Caravan Ribat and desert edge", stay: "Sumeru City Heritage Hotel", tr: "Private vehicle", ml: "Breakfast, dinner", s: [
        ["m", "06:30", "Breakfast at the hotel", "1 hr", "M", "Leave early to beat the heat."],
        ["m", "07:30", "Drive toward the desert edge", "1.5 hrs", "T", "Watch the landscape change from green to gold."],
        ["m", "09:00", "The Caravan Ribat", "2.5 hrs", "G", "Explore the trading post and learn how caravans cross the desert."],
        ["a", "12:00", "Lunch at the Ribat", "1 hr", "O", "A simple meal among travelers, on your own."],
        ["a", "13:30", "Desert edge viewpoint", "1.5 hrs", "S", "Free time to take in the dunes."],
        ["a", "15:30", "Return to the city", "1.5 hrs", "T", "Rest in the air-conditioned vehicle."],
        ["e", "18:30", "Farewell dinner", "2 hrs", "M", "A final group dinner."],
        ["n", "20:45", "Rooftop stargazing", "1.5 hrs", "G", "Clear night skies from the hotel rooftop."],
        ["n", "22:15", "Rest before departure", "", "H", "Your third night at the hotel. Check-out and airport transfer are arranged the next morning."]
      ]}
    ],

    natlan: [
      { t: "Arrival at the Adventure Lodge", stay: "Natlan Adventure Lodge", tr: "Private vehicle", ml: "Welcome dinner", s: [
        ["m", "10:00", "Airport pickup and welcome", "30 min", "T", "Meet your guide and ride to the lodge."],
        ["m", "11:30", "Lodge check-in", "45 min", "H", "Settle in and meet your fellow travelers."],
        ["a", "13:00", "Lunch near the lodge", "1 hr", "O", "A casual meal on your own."],
        ["a", "14:30", "Volcanic viewpoint drive", "2 hrs", "G", "A short drive and walk for your first views of the crater landscape."],
        ["e", "17:30", "Sunset over the lava fields", "1 hr", "S", "Free time for photos as the rock glows red."],
        ["e", "19:00", "Welcome dinner", "1.5 hrs", "M", "A hearty meal of regional dishes at the lodge."],
        ["n", "20:45", "Campfire stories and music", "1.5 hrs", "G", "Local tales and songs around the fire."],
        ["n", "22:15", "Rest at the lodge", "", "F", "Early night before an active day."]
      ]},
      { t: "Tepeac Stadium and the crater trail", stay: "Natlan Adventure Lodge", tr: "Regional shuttle", ml: "Breakfast, lunch", s: [
        ["m", "07:00", "Breakfast at the lodge", "1 hr", "M", "Fuel up for a full day outdoors."],
        ["m", "08:30", "Shuttle to Tepeac Stadium", "40 min", "T", "Ride across volcanic plains."],
        ["m", "09:30", "Tepeac Stadium tour", "2.5 hrs", "G", "See the arena where Natlan's tribes gather to compete and celebrate."],
        ["a", "12:30", "Lunch near the stadium", "1 hr", "M", "A local meal before the afternoon hike."],
        ["a", "14:00", "Crater trail hike", "2.5 hrs", "G", "A moderate hike across volcanic rock. Bring sturdy shoes."],
        ["a", "16:45", "Return to the lodge", "45 min", "T", "Shuttle back for a rest."],
        ["e", "18:30", "Dinner at the lodge", "1.5 hrs", "O", "Choose from the lodge's menu."],
        ["n", "20:30", "Tribal drum and dance night", "1.5 hrs", "G", "Live drums and dance by local performers."],
        ["n", "22:15", "Return to the lodge", "20 min", "T", "Shuttle back to your room."]
      ]},
      { t: "Echoes, springs, and festival night", stay: "Natlan Adventure Lodge", tr: "Private vehicle", ml: "Breakfast, farewell feast", s: [
        ["m", "07:30", "Breakfast at the lodge", "1 hr", "M", "A full breakfast for a day of culture."],
        ["m", "09:00", "Transfer to Children of the Echoes", "1 hr", "T", "Ride through the highlands."],
        ["m", "10:00", "Children of the Echoes", "2 hrs", "G", "Meet the tribe and learn their traditions, crafts, and history."],
        ["a", "12:30", "Lunch on your own", "1.5 hrs", "O", "Try local street food near the village."],
        ["a", "14:00", "The People of the Springs Basin", "2 hrs", "G", "Visit the community and its natural thermal springs."],
        ["a", "16:00", "Hot spring soak", "1.5 hrs", "F", "Relax in the thermal pools after a day on your feet."],
        ["e", "18:30", "Farewell feast", "2 hrs", "M", "A tribal-style feast for the whole group."],
        ["n", "20:45", "Festival night and fire dance", "1.5 hrs", "G", "Join the evening festival with music, lights, and fire dancers."],
        ["n", "22:30", "Return to the lodge", "30 min", "T", "Private vehicle back to your room."]
      ]},
      { t: "Free morning and departure", stay: "Check-out", tr: "Airport drop-off", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the lodge", "1 hr", "M", "Last included meal of the trip."],
        ["m", "09:00", "Check-out and bag storage", "30 min", "H", "Leave your bags at the front desk."],
        ["m", "09:30", "Free morning", "2.5 hrs", "F", "A last walk, photos, or time at the lodge."],
        ["a", "12:30", "Airport transfer", "1 hr", "T", "Your driver takes you to the airport. Lunch is on your own."],
        ["a", "14:30", "Departure", "", "F", "Safe travels. We hope to see you again."]
      ]}
    ],

    fontaine: [
      { t: "Arrival and the Court of Fontaine", stay: "Fontaine Central Hotel", tr: "Private vehicle", ml: "Welcome dinner", s: [
        ["m", "10:00", "Airport pickup and welcome", "30 min", "T", "Meet your guide and ride to Fontaine in a private vehicle."],
        ["m", "11:30", "Hotel check-in and bag drop", "45 min", "H", "Settle in at Fontaine Central Hotel."],
        ["a", "13:00", "Lunch in the city", "1 hr", "O", "Cafes and bistros near the hotel, on your own."],
        ["a", "14:30", "Court of Fontaine", "2 hrs", "G", "Tour the courthouse district and learn how justice shapes city life."],
        ["e", "17:30", "Riverside promenade", "1 hr", "S", "Free time along the water as the evening settles in."],
        ["e", "19:00", "Welcome dinner", "1.5 hrs", "M", "A relaxed group dinner near the hotel."],
        ["n", "20:45", "Waterfront lights stroll", "1.5 hrs", "G", "See the city's bridges and facades lit after dark."],
        ["n", "22:15", "Return to the hotel", "15 min", "F", "Rest up for a day on the water."]
      ]},
      { t: "Waterways and clockwork", stay: "Fontaine Central Hotel", tr: "Water transport, city shuttle", ml: "Breakfast, lunch", s: [
        ["m", "07:30", "Breakfast at the hotel", "1 hr", "M", "A full breakfast before heading out."],
        ["m", "09:00", "Canal ride through the city", "2 hrs", "G", "Glide past historic buildings on Fontaine's waterways."],
        ["m", "11:30", "Clockwork and steam workshop", "1.5 hrs", "G", "See the engineering behind the city's machines up close."],
        ["a", "13:00", "Lunch by the water", "1.5 hrs", "M", "A seasonal set lunch at a canal-side restaurant."],
        ["a", "15:00", "Gallery and boutique walk", "2 hrs", "G", "Browse the arts quarter with your guide."],
        ["e", "18:30", "Dinner in town", "1.5 hrs", "O", "Pick from the city's restaurants."],
        ["n", "20:30", "Night canal cruise", "1.5 hrs", "G", "Drift through the lit-up canals after dark."],
        ["n", "22:15", "Return to the hotel", "15 min", "T", "Shuttle back to your room."]
      ]},
      { t: "Opera Epiclese and fine dining", stay: "Fontaine Central Hotel", tr: "City shuttle", ml: "Breakfast, fine dining dinner", s: [
        ["m", "08:00", "Breakfast at the hotel", "1 hr", "M", "A slower start today."],
        ["m", "09:30", "Opera Epiclese backstage tour", "2 hrs", "G", "Go behind the curtain to see the stage, machinery, and costumes."],
        ["a", "12:30", "Lunch on your own", "1.5 hrs", "O", "Cafes and bistros near the opera house."],
        ["a", "14:30", "Fashion and design district", "2 hrs", "G", "Window-shop and visit local ateliers with your guide."],
        ["a", "16:30", "Free time", "1.5 hrs", "F", "Rest at the hotel or keep exploring."],
        ["e", "18:00", "Fine dining experience", "2 hrs", "M", "A multi-course dinner at a selected restaurant."],
        ["n", "20:30", "Evening at the opera", "2.5 hrs", "G", "Attend an evening performance. The program depends on the season's schedule."],
        ["n", "23:00", "Return to the hotel", "15 min", "T", "Shuttle back after the show."]
      ]},
      { t: "The Lucine Fountain and city views", stay: "Fontaine Central Hotel", tr: "City shuttle, water transport", ml: "Breakfast, lunch", s: [
        ["m", "08:00", "Breakfast at the hotel", "1 hr", "M", "Fuel up for a day of sightseeing."],
        ["m", "09:30", "The Lucine Fountain", "2 hrs", "G", "See the fountain up close and hear the story behind it."],
        ["m", "11:45", "Architecture walk", "1.5 hrs", "G", "Study the city's ornate facades and bridges."],
        ["a", "13:15", "Lunch with a view", "1.5 hrs", "M", "A set lunch overlooking the water."],
        ["a", "15:00", "Free afternoon", "2 hrs", "F", "Shop, nap, or revisit your favorite spot."],
        ["e", "18:30", "Dinner in town", "1.5 hrs", "O", "Choose your last dinner in the city."],
        ["n", "20:30", "Cafe terrace and city lights", "1.5 hrs", "S", "End the evening at a terrace with a view of the lights."],
        ["n", "22:00", "Return to the hotel", "15 min", "F", "Walk back or take the shuttle."]
      ]},
      { t: "Free morning and departure", stay: "Check-out", tr: "Airport drop-off", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the hotel", "1 hr", "M", "Last included meal of the trip."],
        ["m", "09:00", "Check-out and bag storage", "30 min", "H", "Leave your bags at the front desk."],
        ["m", "09:30", "Free morning in the city", "2.5 hrs", "F", "A last walk by the water or some final shopping."],
        ["a", "12:30", "Airport transfer", "45 min", "T", "Your driver takes you to the airport. Lunch is on your own."],
        ["a", "14:00", "Departure", "", "F", "Safe travels. We hope to see you again."]
      ]}
    ],

    snezhnaya: [
      { t: "Arrival in the tundra", stay: "Snezhnaya Winter Lodge", tr: "Private vehicle, heated shuttle", ml: "Hot lunch, welcome dinner", s: [
        ["m", "10:00", "Airport pickup and welcome", "30 min", "T", "A warm vehicle waits for you, and your guide gives a cold-weather briefing."],
        ["m", "11:30", "Lodge check-in", "45 min", "H", "Settle in at Snezhnaya Winter Lodge."],
        ["a", "13:00", "Hot lunch at the lodge", "1 hr", "M", "Soup, bread, and a hot drink to warm up."],
        ["a", "14:30", "Village and frozen lake walk", "2 hrs", "G", "Take your first steps on the snow with your guide."],
        ["e", "17:00", "Hot drinks by the fireplace", "1 hr", "F", "Rest and warm up after the walk."],
        ["e", "18:30", "Welcome dinner", "1.5 hrs", "M", "A hearty group dinner."],
        ["n", "20:30", "First aurora watch", "1.5 hrs", "G", "Step outside with your guide to look for the northern lights, if skies are clear."],
        ["n", "22:00", "Return to the lodge", "15 min", "F", "Warm up and rest."]
      ]},
      { t: "Zapolyarny Palace Outskirts", stay: "Snezhnaya Winter Lodge", tr: "Heated winter shuttle", ml: "Breakfast, hot lunch", s: [
        ["m", "07:30", "Breakfast at the lodge", "1 hr", "M", "A hot breakfast before heading out."],
        ["m", "09:00", "Shuttle to the palace outskirts", "1 hr", "T", "Ride through snow-covered plains."],
        ["m", "10:00", "Zapolyarny Palace Outskirts", "2.5 hrs", "G", "See the frosted grounds and grand architecture from outside the walls."],
        ["a", "12:45", "Hot lunch", "1 hr", "M", "A warm meal at a nearby cafe."],
        ["a", "14:30", "Frosted architecture walk", "2 hrs", "G", "A guided walk past ice-covered buildings and monuments."],
        ["a", "16:30", "Return to the lodge", "1 hr", "T", "Heated shuttle back."],
        ["e", "18:30", "Dinner at the lodge", "1.5 hrs", "O", "Choose from the lodge's menu."],
        ["n", "20:30", "Aurora watching from the deck", "1.5 hrs", "S", "Blankets and hot drinks on the lodge deck."],
        ["n", "22:15", "Rest at the lodge", "", "F", "Warm up and get some sleep."]
      ]},
      { t: "Frost-bound Valleys", stay: "Snezhnaya Winter Lodge", tr: "Heated winter shuttle", ml: "Breakfast, hot lunch, dinner", s: [
        ["m", "08:00", "Breakfast at the lodge", "1 hr", "M", "Fuel up for a day in the snow."],
        ["m", "09:00", "Shuttle to Frost-bound Valleys", "1 hr", "T", "Watch the valleys open up along the way."],
        ["m", "10:00", "Snowfield walk", "2.5 hrs", "G", "A guided walk across open snow with wide, quiet views."],
        ["a", "12:45", "Hot picnic lunch", "1 hr", "M", "Soup and sandwiches in a sheltered spot."],
        ["a", "14:15", "Frozen lake viewpoint", "1.5 hrs", "S", "Free time for photos at the lake edge."],
        ["a", "16:15", "Return to the lodge", "1 hr", "T", "Heated shuttle back."],
        ["e", "18:30", "Hearty stew dinner", "1.5 hrs", "M", "A warm group meal at the lodge."],
        ["n", "20:30", "Stargazing and aurora", "1.5 hrs", "G", "Dark skies and a guide to point out the constellations."],
        ["n", "22:00", "Return to the lodge", "15 min", "F", "Warm up and rest."]
      ]},
      { t: "Glacial Outposts", stay: "Snezhnaya Winter Lodge", tr: "Private vehicle", ml: "Breakfast, hot lunch, farewell dinner", s: [
        ["m", "08:00", "Breakfast at the lodge", "1 hr", "M", "A hot breakfast for a long drive."],
        ["m", "09:00", "Drive to the Glacial Outposts", "1.5 hrs", "T", "A scenic route past ice and rock."],
        ["m", "10:30", "Glacial Outposts tour", "2.5 hrs", "G", "Explore the outposts and learn how people live at the edge of the ice."],
        ["a", "13:00", "Hot lunch", "1 hr", "M", "A warm meal indoors."],
        ["a", "14:30", "Ice formations photo walk", "1.5 hrs", "S", "Free time among the ice for photos."],
        ["a", "16:30", "Return to the lodge", "1.5 hrs", "T", "Rest in the heated vehicle."],
        ["e", "19:00", "Farewell dinner", "2 hrs", "M", "A final multi-course group dinner."],
        ["n", "21:00", "Final aurora night", "1.5 hrs", "G", "One more chance to see the lights with your guide."],
        ["n", "22:30", "Return to the lodge", "15 min", "F", "Warm up and pack for tomorrow."]
      ]},
      { t: "Free morning and departure", stay: "Check-out", tr: "Airport drop-off", ml: "Breakfast", s: [
        ["m", "07:30", "Breakfast at the lodge", "1 hr", "M", "Last included meal of the trip."],
        ["m", "09:00", "Check-out and bag storage", "30 min", "H", "Leave your bags at the front desk."],
        ["m", "09:30", "Free morning", "2.5 hrs", "F", "A last walk in the snow or time by the fireplace."],
        ["a", "12:30", "Airport transfer", "1 hr", "T", "Your driver takes you to the airport. Lunch is on your own."],
        ["a", "14:30", "Departure", "", "F", "Safe travels. We hope to see you again."]
      ]}
    ]
  };

  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function renderDay(root, days, index) {
    var d = days[index];
    var body = root.querySelector(".itin-body");
    body.textContent = "";

    var sum = make("div", "itin-sum");
    sum.appendChild(make("p", "itin-dayno", "DAY " + (index + 1)));
    sum.appendChild(make("h4", "", d.t));
    var grid = make("div", "itin-sum-grid");
    [
      ["accommodation.png", "Stay", d.stay],
      ["transportation.png", "Transport", d.tr],
      ["meals.png", "Meals", d.ml]
    ].forEach(function (c) {
      var cell = make("div", "itin-sum-cell");
      var img = make("img");
      img.src = "images/" + c[0];
      img.alt = "";
      cell.appendChild(img);
      cell.appendChild(make("b", "", c[1]));
      cell.appendChild(make("span", "", c[2]));
      grid.appendChild(cell);
    });
    sum.appendChild(grid);
    body.appendChild(sum);

    var nights = d.s.filter(function (s) { return s[0] === "n"; }).length;
    body.appendChild(make("p", "itin-count",
      d.s.length + " stops" + (nights ? ", including " + nights + " night " + (nights === 1 ? "activity" : "activities") : "")));

    var tl = make("div", "itin-tl");
    var last = "";
    d.s.forEach(function (s) {
      if (s[0] !== last) {
        last = s[0];
        tl.appendChild(make("p", "itin-per" + (s[0] === "n" ? " is-night" : ""), PERIOD[s[0]]));
      }
      var card = make("div", "itin-stop" + (s[0] === "n" ? " is-night" : ""));
      card.appendChild(make("p", "itin-time", s[1]));
      card.appendChild(make("p", "itin-name", s[2]));
      card.appendChild(make("p", "itin-meta", (s[3] ? s[3] + " \u00B7 " : "") + TYPE[s[4]]));
      card.appendChild(make("p", "itin-desc", s[5]));
      tl.appendChild(card);
    });
    body.appendChild(tl);
  }

  function init(root) {
    var days = DATA[root.getAttribute("data-dest")];
    if (!days) return;
    var nav = root.querySelector(".itin-nav");
    var tabs = [];

    function select(i) {
      tabs.forEach(function (b, j) {
        b.classList.toggle("is-on", i === j);
        b.setAttribute("aria-pressed", i === j ? "true" : "false");
      });
      renderDay(root, days, i);
      root.querySelector(".itin-body").scrollTop = 0;
    }

    days.forEach(function (d, i) {
      var b = make("button", "itin-tab", "DAY " + (i + 1));
      b.type = "button";
      b.addEventListener("click", function () { select(i); });
      nav.appendChild(b);
      tabs.push(b);
    });
    select(0);
  }

  document.querySelectorAll(".pkg-itin[data-dest]").forEach(init);
})();