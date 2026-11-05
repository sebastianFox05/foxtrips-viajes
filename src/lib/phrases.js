/*
 * Banco de frases en ingles de Estados Unidos para el dia a dia.
 * en: frase en ingles · es: traduccion · say: pronunciacion aproximada para hispanohablantes.
 */

export const PHRASE_CATEGORIES = [
  {
    key: 'basicos',
    label: 'Básicos',
    icon: 'chat',
    tip: 'En EE. UU. se usa mucho "please", "thank you" y "excuse me". Sonreír y decir "Hi, how are you?" al entrar a una tienda es lo normal; la respuesta típica es "Good, thanks! And you?".',
    phrases: [
      { en: 'Hi, how are you?', es: 'Hola, ¿cómo estás?', say: 'jái, jáu ar iú' },
      { en: "Good, thanks! And you?", es: '¡Bien, gracias! ¿Y tú?', say: 'gud, zénks! and iú' },
      { en: 'Excuse me.', es: 'Disculpe / Permiso.', say: 'ekskiús mi' },
      { en: "I'm sorry, I don't speak much English.", es: 'Lo siento, no hablo mucho inglés.', say: 'áim sóri, ai dóunt spik mach ínglish' },
      { en: 'Could you say that again, please?', es: '¿Podría repetirlo, por favor?', say: 'kud iú séi dat aguén, plis' },
      { en: 'Could you speak more slowly?', es: '¿Podría hablar más despacio?', say: 'kud iú spik mor slóuli' },
      { en: 'Do you speak Spanish?', es: '¿Habla español?', say: 'du iú spik spánish' },
      { en: 'Thank you so much!', es: '¡Muchas gracias!', say: 'zénk iú sóu mach' },
      { en: "You're welcome.", es: 'De nada.', say: 'iur wélkam' },
      { en: 'Have a nice day!', es: '¡Que tenga un buen día!', say: 'jav a náis déi' }
    ]
  },
  {
    key: 'cafe',
    label: 'Cafetería',
    icon: 'coffee',
    tip: 'Los tamaños suelen ser small, medium y large (en Starbucks: tall, grande y venti). "For here or to go?" significa "¿para tomar aquí o para llevar?". Te pedirán tu nombre para escribirlo en el vaso.',
    phrases: [
      { en: 'Can I get a medium latte, please?', es: '¿Me da un latte mediano, por favor?', say: 'kan ai guet a mídium látei, plis' },
      { en: "I'd like a black coffee.", es: 'Quisiera un café negro.', say: 'áid láik a blak kófi' },
      { en: 'Can I have it with oat milk?', es: '¿Me lo pone con leche de avena?', say: 'kan ai jav it wiz óut milk' },
      { en: 'To go, please.', es: 'Para llevar, por favor.', say: 'tu góu, plis' },
      { en: 'For here, please.', es: 'Para tomar aquí, por favor.', say: 'for jíer, plis' },
      { en: 'Can I get it iced?', es: '¿Me lo da con hielo / frío?', say: 'kan ai guet it áist' },
      { en: 'Decaf, please.', es: 'Descafeinado, por favor.', say: 'díkaf, plis' },
      { en: "What's your Wi-Fi password?", es: '¿Cuál es la contraseña del wifi?', say: 'uats ior uái-fái pásword' },
      { en: 'Could I get a croissant too?', es: '¿Me da también un cruasán?', say: 'kud ai guet a krasánt tu' }
    ]
  },
  {
    key: 'restaurante',
    label: 'Restaurante',
    icon: 'food',
    tip: 'La propina no está incluida: lo normal es dejar entre 18 % y 20 % del total antes de impuestos. Los precios del menú no incluyen el impuesto (sales tax). El agua del grifo es gratis: pide "tap water".',
    phrases: [
      { en: 'A table for four, please.', es: 'Una mesa para cuatro, por favor.', say: 'a téibol for for, plis' },
      { en: 'Do you have a reservation?', es: '¿Tiene reserva? (te lo preguntan)', say: 'du iú jav a reservéishon' },
      { en: 'Can we see the menu, please?', es: '¿Nos trae la carta, por favor?', say: 'kan uí si de méniu, plis' },
      { en: 'What do you recommend?', es: '¿Qué nos recomienda?', say: 'uat du iú rekoménd' },
      { en: "I'll have the burger, medium, please.", es: 'Yo quiero la hamburguesa, en su punto, por favor.', say: 'áil jav de bérguer, mídium, plis' },
      { en: 'Can I get some tap water?', es: '¿Me trae agua del grifo?', say: 'kan ai guet som tap uóter' },
      { en: "I'm allergic to nuts.", es: 'Soy alérgico a los frutos secos.', say: 'áim alérdyik tu nats' },
      { en: 'Could we get the check, please?', es: '¿Nos trae la cuenta, por favor?', say: 'kud uí guet de chek, plis' },
      { en: 'Can we split the bill?', es: '¿Podemos dividir la cuenta?', say: 'kan uí split de bil' },
      { en: 'Can I get a box for this?', es: '¿Me da un recipiente para llevarme esto?', say: 'kan ai guet a boks for dis' }
    ]
  },
  {
    key: 'ropa',
    label: 'Ropa y tiendas',
    icon: 'shirt',
    tip: 'Las tallas de EE. UU. son distintas: en ropa se usan S, M y L o números (2, 4, 6…). En zapatos, un 38 europeo es más o menos un 7 de mujer o un 6 de hombre. El precio de la etiqueta no lleva el impuesto.',
    phrases: [
      { en: "I'm just looking, thanks.", es: 'Solo estoy mirando, gracias.', say: 'áim dyast lúking, zénks' },
      { en: 'Do you have this in a medium?', es: '¿Tiene esto en talla M?', say: 'du iú jav dis in a mídium' },
      { en: 'Do you have it in another color?', es: '¿Lo tiene en otro color?', say: 'du iú jav it in anóder kólor' },
      { en: 'Where are the fitting rooms?', es: '¿Dónde están los probadores?', say: 'uér ar de fíting rums' },
      { en: "It's too big / too small.", es: 'Me queda grande / pequeño.', say: 'its tu big / tu smol' },
      { en: 'How much is this?', es: '¿Cuánto cuesta esto?', say: 'jáu mach is dis' },
      { en: 'Is this on sale?', es: '¿Esto está en rebaja?', say: 'is dis on séil' },
      { en: "I'll take it.", es: 'Me lo llevo.', say: 'áil téik it' },
      { en: 'Can I return it if it doesn\'t fit?', es: '¿Puedo devolverlo si no me queda?', say: 'kan ai ritérn it if it dásent fit' },
      { en: 'Can I pay by card?', es: '¿Puedo pagar con tarjeta?', say: 'kan ai péi bai kard' }
    ]
  },
  {
    key: 'super',
    label: 'Supermercado',
    icon: 'cart',
    tip: 'En la caja te preguntarán "Paper or plastic?" (bolsa de papel o plástico) y si quieres "cash back" (sacar efectivo). En muchas ciudades las bolsas se cobran.',
    phrases: [
      { en: 'Where can I find the water?', es: '¿Dónde encuentro el agua?', say: 'uér kan ai fáind de uóter' },
      { en: 'Which aisle is the bread in?', es: '¿En qué pasillo está el pan?', say: 'uích áil is de bred in' },
      { en: 'Do you have any bags?', es: '¿Tiene bolsas?', say: 'du iú jav éni bags' },
      { en: 'Paper, please.', es: 'De papel, por favor.', say: 'péiper, plis' },
      { en: 'No cash back, thanks.', es: 'No quiero sacar efectivo, gracias.', say: 'nóu kash bak, zénks' },
      { en: 'Can I get a receipt?', es: '¿Me da el recibo?', say: 'kan ai guet a risít' },
      { en: 'Is there a pharmacy nearby?', es: '¿Hay una farmacia cerca?', say: 'is der a fármasi níerbai' }
    ]
  },
  {
    key: 'transporte',
    label: 'Metro y transporte',
    icon: 'train',
    tip: 'En Nueva York puedes pagar el metro acercando tu tarjeta o móvil al lector OMNY. "Uptown" es hacia el norte y "Downtown" hacia el sur. Los trenes "express" se saltan estaciones.',
    phrases: [
      { en: 'How do I get to Times Square?', es: '¿Cómo llego a Times Square?', say: 'jáu du ai guet tu táims skuér' },
      { en: 'Which train goes to Brooklyn?', es: '¿Qué tren va a Brooklyn?', say: 'uích tréin góus tu brúklin' },
      { en: 'Is this the uptown train?', es: '¿Este tren va hacia el norte?', say: 'is dis di áptaun tréin' },
      { en: 'Where is the nearest subway station?', es: '¿Dónde está la estación de metro más cercana?', say: 'uér is de níerest sábuei stéishon' },
      { en: 'Does this bus stop at Central Park?', es: '¿Este autobús para en Central Park?', say: 'das dis bas stop at séntral park' },
      { en: 'Can you take me to this address?', es: '¿Me lleva a esta dirección? (taxi)', say: 'kan iú téik mi tu dis ádres' },
      { en: 'How long does it take?', es: '¿Cuánto se tarda?', say: 'jáu long das it téik' },
      { en: 'You can drop me off here.', es: 'Puede dejarme aquí.', say: 'iú kan drop mi of jíer' }
    ]
  },
  {
    key: 'direcciones',
    label: 'Direcciones',
    icon: 'compass',
    tip: 'En Manhattan las calles (streets) van de este a oeste y las avenidas (avenues) de norte a sur. "Block" es una cuadra: te dirán "It\'s two blocks away".',
    phrases: [
      { en: 'Excuse me, where is…?', es: 'Disculpe, ¿dónde está…?', say: 'ekskiús mi, uér is…' },
      { en: 'Is it far from here?', es: '¿Está lejos de aquí?', say: 'is it far from jíer' },
      { en: 'Can I walk there?', es: '¿Se puede ir caminando?', say: 'kan ai uók der' },
      { en: 'Go straight and turn left.', es: 'Siga recto y gire a la izquierda.', say: 'góu stréit and tern left' },
      { en: "It's two blocks away.", es: 'Está a dos cuadras.', say: 'its tu bloks euéi' },
      { en: 'Could you show me on the map?', es: '¿Me lo enseña en el mapa?', say: 'kud iú shóu mi on de map' },
      { en: "I'm lost.", es: 'Estoy perdido.', say: 'áim lost' }
    ]
  },
  {
    key: 'hotel',
    label: 'Hotel',
    icon: 'bed',
    tip: 'El check-in suele ser a las 3 p. m. y el check-out a las 11 a. m. Muchos hoteles cobran un "resort fee" o "facility fee" diario aparte; pregúntalo al llegar.',
    phrases: [
      { en: 'I have a reservation under the name…', es: 'Tengo una reserva a nombre de…', say: 'ai jav a reservéishon ánder de néim…' },
      { en: 'What time is check-out?', es: '¿A qué hora es la salida?', say: 'uat táim is chek-áut' },
      { en: 'Can we leave our bags here?', es: '¿Podemos dejar las maletas aquí?', say: 'kan uí liv áuer bags jíer' },
      { en: 'Is breakfast included?', es: '¿El desayuno está incluido?', say: 'is brékfast inklúded' },
      { en: 'Could I get some extra towels?', es: '¿Me da toallas extra?', say: 'kud ai guet som ékstra táuels' },
      { en: "The AC isn't working.", es: 'El aire acondicionado no funciona.', say: 'di ei-sí ísent uérking' },
      { en: 'Can I get a late check-out?', es: '¿Puedo salir más tarde?', say: 'kan ai guet a léit chek-áut' }
    ]
  },
  {
    key: 'aeropuerto',
    label: 'Aeropuerto',
    icon: 'plane',
    tip: 'En migración te preguntarán el motivo y la duración del viaje y dónde te alojas. Responde corto y claro, y ten a mano la dirección del hotel y el billete de vuelta.',
    phrases: [
      { en: "I'm here on vacation.", es: 'Estoy aquí de vacaciones.', say: 'áim jíer on veikéishon' },
      { en: "I'm staying for five days.", es: 'Me quedo cinco días.', say: 'áim stéing for fáiv déis' },
      { en: "I'm staying at a hotel in Manhattan.", es: 'Me alojo en un hotel en Manhattan.', say: 'áim stéing at a joutél in manjátan' },
      { en: 'Where is baggage claim?', es: '¿Dónde se recogen las maletas?', say: 'uér is bágadch kléim' },
      { en: 'My luggage is missing.', es: 'Mi equipaje no ha llegado.', say: 'mai lágadch is mísing' },
      { en: 'Where can I get a taxi?', es: '¿Dónde puedo tomar un taxi?', say: 'uér kan ai guet a táksi' },
      { en: 'Is this the line for check-in?', es: '¿Esta es la fila para facturar?', say: 'is dis de láin for chek-ín' }
    ]
  },
  {
    key: 'pagar',
    label: 'Pagar y propinas',
    icon: 'money',
    tip: 'Al pagar con tarjeta, la pantalla suele proponer 18 %, 20 % o 25 % de propina. En cafeterías de mostrador es opcional; en restaurantes con servicio en mesa se espera.',
    phrases: [
      { en: 'Do you take credit cards?', es: '¿Aceptan tarjeta de crédito?', say: 'du iú téik krédit kards' },
      { en: 'Can I pay with Apple Pay?', es: '¿Puedo pagar con el móvil (Apple Pay)?', say: 'kan ai péi wiz ápol péi' },
      { en: 'Is tip included?', es: '¿La propina está incluida?', say: 'is tip inklúded' },
      { en: 'Keep the change.', es: 'Quédese con el cambio.', say: 'kip de chéindch' },
      { en: 'Could you break a twenty?', es: '¿Me cambia un billete de veinte?', say: 'kud iú bréik a tuénti' },
      { en: 'Is there an ATM nearby?', es: '¿Hay un cajero cerca?', say: 'is der an ei-ti-ém níerbai' }
    ]
  },
  {
    key: 'social',
    label: 'Charlar',
    icon: 'users',
    tip: 'La conversación casual (small talk) es muy común: el clima, de dónde eres o qué te parece la ciudad. "What\'s up?" es un saludo informal; basta con responder "Not much!".',
    phrases: [
      { en: "I'm from Colombia.", es: 'Soy de Colombia.', say: 'áim from kolómbia' },
      { en: "It's our first time in New York.", es: 'Es nuestra primera vez en Nueva York.', say: 'its áuer ferst táim in nu iork' },
      { en: 'Can you take a picture of us?', es: '¿Nos puede tomar una foto?', say: 'kan iú téik a píkcher of as' },
      { en: 'Any recommendations around here?', es: '¿Alguna recomendación por aquí?', say: 'éni rekomendéishons aráund jíer' },
      { en: 'Nice to meet you!', es: '¡Encantado de conocerte!', say: 'náis tu mit iú' },
      { en: 'That sounds great!', es: '¡Suena genial!', say: 'dat sáunds gréit' }
    ]
  },
  {
    key: 'emergencias',
    label: 'Emergencias y salud',
    icon: 'alert',
    tip: 'El número de emergencias es el 911 (policía, bomberos y ambulancia). Para molestias leves, las "urgent care" son más rápidas y baratas que urgencias del hospital. Lleva siempre tu seguro de viaje.',
    phrases: [
      { en: 'Help!', es: '¡Ayuda!', say: 'jelp' },
      { en: 'Please call 911.', es: 'Por favor, llame al 911.', say: 'plis kol náin-uán-uán' },
      { en: 'I need a doctor.', es: 'Necesito un médico.', say: 'ai nid a dóktor' },
      { en: 'I lost my passport.', es: 'He perdido mi pasaporte.', say: 'ai lost mai pásport' },
      { en: 'Someone stole my wallet.', es: 'Me han robado la cartera.', say: 'sámuan stóul mai uálet' },
      { en: 'Where is the nearest hospital?', es: '¿Dónde está el hospital más cercano?', say: 'uér is de níerest jóspital' },
      { en: 'I have travel insurance.', es: 'Tengo seguro de viaje.', say: 'ai jav trável inshúrans' },
      { en: 'Do you have something for a headache?', es: '¿Tiene algo para el dolor de cabeza?', say: 'du iú jav sámzing for a jédeik' }
    ]
  }
];
