/*
 * Banco de frases para viajar, en siete idiomas: ingles, español, portugues, frances, italiano, aleman y japones.
 * Cada frase es una fila [en, es, pt, fr, it, de, ja, romaji, say]:
 *   - se enseña en el idioma del destino y se explica en el idioma de la app;
 *   - romaji: lectura del japones en letras latinas · say: pronunciacion aproximada del ingles para hispanohablantes;
 *   - el texto en ingles identifica la frase (favoritas).
 * Las etiquetas y los consejos (pensados para Estados Unidos) se traducen al pintarlos con t().
 */
import { m } from './i18n/index.js';

export const PHRASE_LANGUAGES = ['en', 'es', 'pt', 'fr', 'it', 'de', 'ja'];

/* Idioma de las frases segun el pais del destino; donde no hay ninguno de la lista se usa el ingles */
const LANGUAGE_COUNTRIES = {
  es: 'ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ',
  pt: 'BR PT AO MZ CV GW ST TL',
  fr: 'FR BE MC LU SN CI MA TN DZ HT GP MQ RE PF NC MG CM',
  it: 'IT SM VA',
  de: 'DE AT CH LI',
  ja: 'JP'
};

export function languageForCountry(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  if (!code) return '';
  const match = Object.entries(LANGUAGE_COUNTRIES).find(([, countries]) => countries.split(' ').includes(code));
  return match ? match[0] : 'en';
}

/* Voz del idioma con el acento del pais cuando el navegador la tiene (pt-PT, en-GB, es-MX…) */
const SPEECH_DEFAULTS = { en: 'en-US', es: 'es-ES', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT', de: 'de-DE', ja: 'ja-JP' };
const SPEECH_BY_COUNTRY = {
  en: { GB: 'en-GB', IE: 'en-IE', AU: 'en-AU', NZ: 'en-NZ', CA: 'en-CA', IN: 'en-IN', ZA: 'en-ZA' },
  es: { MX: 'es-MX', US: 'es-US', AR: 'es-AR', CO: 'es-CO', CL: 'es-CL', PE: 'es-PE' },
  pt: { PT: 'pt-PT' },
  fr: { CA: 'fr-CA', BE: 'fr-BE', CH: 'fr-CH' },
  de: { AT: 'de-AT', CH: 'de-CH' }
};

export function speechLocale(language, countryCode) {
  return SPEECH_BY_COUNTRY[language]?.[String(countryCode || '').toUpperCase()] || SPEECH_DEFAULTS[language] || language;
}

const phrase = ([en, es, pt, fr, it, de, ja, romaji, say, meaning]) => ({ en, es, pt, fr, it, de, ja, romaji, say, meaning });

export const PHRASE_CATEGORIES = [
  {
    key: 'basicos',
    label: m('Básicos'),
    icon: 'chat',
    tip: m('En EE. UU. se usa mucho "please", "thank you" y "excuse me". Sonreír y decir "Hi, how are you?" al entrar a una tienda es lo normal; la respuesta típica es "Good, thanks! And you?".'),
    phrases: [
      ['Hi, how are you?', 'Hola, ¿cómo estás?', 'Olá, tudo bem?', 'Bonjour, comment allez-vous ?', 'Ciao, come stai?', 'Hallo, wie geht es Ihnen?', 'こんにちは、お元気ですか？', 'Konnichiwa, ogenki desu ka?', 'jái, jáu ar iú'],
      ['Good, thanks! And you?', '¡Bien, gracias! ¿Y tú?', 'Bem, obrigado! E você?', 'Bien, merci ! Et vous ?', 'Bene, grazie! E tu?', 'Gut, danke! Und Ihnen?', '元気です、ありがとう。あなたは？', 'Genki desu, arigatō. Anata wa?', 'gud, zénks! and iú'],
      ['Excuse me.', 'Disculpe.', 'Com licença.', 'Excusez-moi.', 'Mi scusi.', 'Entschuldigung.', 'すみません。', 'Sumimasen.', 'ekskiús mi'],
      ['I\'m sorry, I don\'t speak much English.', 'Lo siento, no hablo mucho español.', 'Desculpe, não falo muito português.', 'Désolé, je ne parle pas bien français.', 'Mi dispiace, non parlo bene l’italiano.', 'Tut mir leid, ich spreche nicht gut Deutsch.', 'すみません、日本語があまり話せません。', 'Sumimasen, nihongo ga amari hanasemasen.', 'áim sóri, ai dóunt spik mach ínglish', { es: 'Lo siento, no hablo bien su idioma.', en: 'I\'m sorry, I don\'t speak your language well.', pt: 'Desculpe, não falo bem o seu idioma.' }],
      ['Could you say that again, please?', '¿Podría repetirlo, por favor?', 'Pode repetir, por favor?', 'Pouvez-vous répéter, s’il vous plaît ?', 'Può ripetere, per favore?', 'Können Sie das bitte wiederholen?', 'もう一度お願いします。', 'Mō ichido onegaishimasu.', 'kud iú séi dat aguén, plis'],
      ['Could you speak more slowly?', '¿Podría hablar más despacio?', 'Pode falar mais devagar?', 'Pouvez-vous parler plus lentement ?', 'Può parlare più lentamente?', 'Können Sie bitte langsamer sprechen?', 'もう少しゆっくり話してください。', 'Mō sukoshi yukkuri hanashite kudasai.', 'kud iú spik mor slóuli'],
      ['I don\'t understand.', 'No entiendo.', 'Não entendo.', 'Je ne comprends pas.', 'Non capisco.', 'Ich verstehe nicht.', 'わかりません。', 'Wakarimasen.', 'ai dóunt anderstánd'],
      ['Thank you so much!', '¡Muchas gracias!', 'Muito obrigado!', 'Merci beaucoup !', 'Grazie mille!', 'Vielen Dank!', 'ありがとうございます！', 'Arigatō gozaimasu!', 'zénk iú sóu mach'],
      ['You\'re welcome.', 'De nada.', 'De nada.', 'De rien.', 'Prego.', 'Gern geschehen.', 'どういたしまして。', 'Dō itashimashite.', 'iur wélkam'],
      ['Have a nice day!', '¡Que tenga un buen día!', 'Tenha um bom dia!', 'Bonne journée !', 'Buona giornata!', 'Einen schönen Tag noch!', '良い一日を！', 'Yoi ichinichi o!', 'jav a náis déi']
    ].map(phrase)
  },
  {
    key: 'cafe',
    label: m('Cafetería'),
    icon: 'coffee',
    tip: m('Los tamaños suelen ser small, medium y large (en Starbucks: tall, grande y venti). "For here or to go?" significa "¿para tomar aquí o para llevar?". Te pedirán tu nombre para escribirlo en el vaso.'),
    phrases: [
      ['Can I get a medium latte, please?', '¿Me da un café con leche mediano, por favor?', 'Um café com leite médio, por favor.', 'Un café au lait moyen, s’il vous plaît.', 'Un caffellatte medio, per favore.', 'Einen mittleren Milchkaffee, bitte.', 'カフェラテのMサイズをください。', 'Kafe rate no emu saizu o kudasai.', 'kan ai guet a mídium látei, plis'],
      ['I\'d like a black coffee.', 'Quisiera un café negro.', 'Queria um café preto.', 'Je voudrais un café noir.', 'Vorrei un caffè nero.', 'Ich hätte gern einen schwarzen Kaffee.', 'ブラックコーヒーをお願いします。', 'Burakku kōhī o onegaishimasu.', 'áid láik a blak kófi'],
      ['Can I have it with oat milk?', '¿Me lo pone con leche de avena?', 'Pode ser com leite de aveia?', 'C’est possible avec du lait d’avoine ?', 'Posso averlo con latte d’avena?', 'Geht das mit Hafermilch?', 'オーツミルクにできますか？', 'Ōtsu miruku ni dekimasu ka?', 'kan ai jav it wiz óut milk'],
      ['To go, please.', 'Para llevar, por favor.', 'Para viagem, por favor.', 'À emporter, s’il vous plaît.', 'Da portare via, per favore.', 'Zum Mitnehmen, bitte.', '持ち帰りでお願いします。', 'Mochikaeri de onegaishimasu.', 'tu góu, plis'],
      ['For here, please.', 'Para tomar aquí, por favor.', 'Para consumir aqui, por favor.', 'Sur place, s’il vous plaît.', 'Da consumare qui, per favore.', 'Zum Hieressen, bitte.', '店内でお願いします。', 'Tennai de onegaishimasu.', 'for jíer, plis'],
      ['Can I get it iced?', '¿Me lo da con hielo?', 'Pode ser gelado?', 'Je peux l’avoir glacé ?', 'Posso averlo freddo, con ghiaccio?', 'Kann ich das mit Eis bekommen?', 'アイスにできますか？', 'Aisu ni dekimasu ka?', 'kan ai guet it áist'],
      ['Decaf, please.', 'Descafeinado, por favor.', 'Descafeinado, por favor.', 'Un déca, s’il vous plaît.', 'Decaffeinato, per favore.', 'Entkoffeiniert, bitte.', 'カフェインレスでお願いします。', 'Kafeinresu de onegaishimasu.', 'díkaf, plis'],
      ['What\'s the Wi-Fi password?', '¿Cuál es la contraseña del wifi?', 'Qual é a senha do wi-fi?', 'Quel est le mot de passe du wifi ?', 'Qual è la password del wifi?', 'Wie lautet das WLAN-Passwort?', 'Wi-Fiのパスワードは何ですか？', 'Waifai no pasuwādo wa nan desu ka?', 'uats de uái-fái pásword'],
      ['Could I get a croissant too?', '¿Me da también un cruasán?', 'Pode me dar um croissant também?', 'Je peux avoir un croissant aussi ?', 'Posso avere anche un cornetto?', 'Kann ich auch ein Croissant haben?', 'クロワッサンもください。', 'Kurowassan mo kudasai.', 'kud ai guet a krasánt tu']
    ].map(phrase)
  },
  {
    key: 'restaurante',
    label: m('Restaurante'),
    icon: 'food',
    tip: m('La propina no está incluida: lo normal es dejar entre 18 % y 20 % del total antes de impuestos. Los precios del menú no incluyen el impuesto (sales tax). El agua del grifo es gratis: pide "tap water".'),
    phrases: [
      ['A table for four, please.', 'Una mesa para cuatro, por favor.', 'Uma mesa para quatro, por favor.', 'Une table pour quatre, s’il vous plaît.', 'Un tavolo per quattro, per favore.', 'Einen Tisch für vier, bitte.', '4人です。', 'Yonin desu.', 'a téibol for for, plis'],
      ['We have a reservation.', 'Tenemos una reserva.', 'Temos uma reserva.', 'Nous avons une réservation.', 'Abbiamo una prenotazione.', 'Wir haben reserviert.', '予約しています。', 'Yoyaku shite imasu.', 'uí jav a reservéishon'],
      ['Can we see the menu, please?', '¿Nos trae la carta, por favor?', 'Pode trazer o cardápio, por favor?', 'La carte, s’il vous plaît.', 'Possiamo vedere il menù, per favore?', 'Können wir bitte die Speisekarte haben?', 'メニューをお願いします。', 'Menyū o onegaishimasu.', 'kan uí si de méniu, plis'],
      ['What do you recommend?', '¿Qué nos recomienda?', 'O que você recomenda?', 'Que nous recommandez-vous ?', 'Che cosa ci consiglia?', 'Was empfehlen Sie?', 'おすすめは何ですか？', 'Osusume wa nan desu ka?', 'uat du iú rekoménd'],
      ['I\'ll have this, please.', 'Yo quiero esto, por favor.', 'Vou querer isto, por favor.', 'Je vais prendre ça, s’il vous plaît.', 'Prendo questo, per favore.', 'Ich nehme das, bitte.', 'これをください。', 'Kore o kudasai.', 'áil jav dis, plis'],
      ['Can I get some tap water?', '¿Me trae agua del grifo?', 'Pode trazer água da torneira?', 'Une carafe d’eau, s’il vous plaît.', 'Posso avere dell’acqua del rubinetto?', 'Kann ich Leitungswasser bekommen?', 'お水をください。', 'Omizu o kudasai.', 'kan ai guet som tap uóter'],
      ['I\'m allergic to nuts.', 'Soy alérgico a los frutos secos.', 'Sou alérgico a nozes.', 'Je suis allergique aux fruits à coque.', 'Sono allergico alla frutta secca.', 'Ich bin allergisch gegen Nüsse.', 'ナッツアレルギーがあります。', 'Nattsu arerugī ga arimasu.', 'áim alérdyik tu nats'],
      ['Could we get the check, please?', '¿Nos trae la cuenta, por favor?', 'A conta, por favor.', 'L’addition, s’il vous plaît.', 'Il conto, per favore.', 'Die Rechnung, bitte.', 'お会計をお願いします。', 'Okaikei o onegaishimasu.', 'kud uí guet de chek, plis'],
      ['Can we split the bill?', '¿Podemos dividir la cuenta?', 'Podemos dividir a conta?', 'On peut partager l’addition ?', 'Possiamo dividere il conto?', 'Können wir getrennt zahlen?', '別々に払えますか？', 'Betsubetsu ni haraemasu ka?', 'kan uí split de bil'],
      ['Can I take the rest to go?', '¿Me puedo llevar lo que sobró?', 'Posso levar o que sobrou?', 'Je peux emporter le reste ?', 'Posso portare via il resto?', 'Kann ich den Rest mitnehmen?', '残りを持ち帰れますか？', 'Nokori o mochikaeremasu ka?', 'kan ai téik de rest tu góu']
    ].map(phrase)
  },
  {
    key: 'ropa',
    label: m('Ropa y tiendas'),
    icon: 'shirt',
    tip: m('Las tallas de EE. UU. son distintas: en ropa se usan S, M y L o números (2, 4, 6…). En zapatos, un 38 europeo es más o menos un 7 de mujer o un 6 de hombre. El precio de la etiqueta no lleva el impuesto.'),
    phrases: [
      ['I\'m just looking, thanks.', 'Solo estoy mirando, gracias.', 'Só estou olhando, obrigado.', 'Je regarde seulement, merci.', 'Sto solo guardando, grazie.', 'Ich schaue mich nur um, danke.', '見ているだけです。', 'Mite iru dake desu.', 'áim dyast lúking, zénks'],
      ['Do you have this in a medium?', '¿Tiene esto en talla M?', 'Tem isto no tamanho M?', 'Vous l’avez en taille M ?', 'Ce l’ha in taglia M?', 'Haben Sie das in Größe M?', 'これのMサイズはありますか？', 'Kore no emu saizu wa arimasu ka?', 'du iú jav dis in a mídium'],
      ['Do you have it in another color?', '¿Lo tiene en otro color?', 'Tem em outra cor?', 'Vous l’avez dans une autre couleur ?', 'Ce l’ha in un altro colore?', 'Haben Sie das in einer anderen Farbe?', '他の色はありますか？', 'Hoka no iro wa arimasu ka?', 'du iú jav it in anóder kólor'],
      ['Where are the fitting rooms?', '¿Dónde están los probadores?', 'Onde ficam os provadores?', 'Où sont les cabines d’essayage ?', 'Dove sono i camerini?', 'Wo sind die Umkleidekabinen?', '試着室はどこですか？', 'Shichakushitsu wa doko desu ka?', 'uér ar de fíting rums'],
      ['It\'s too big / too small.', 'Me queda grande / pequeño.', 'Ficou grande / pequeno.', 'C’est trop grand / trop petit.', 'È troppo grande / troppo piccolo.', 'Es ist zu groß / zu klein.', '大きすぎます / 小さすぎます。', 'Ōkisugimasu / chiisasugimasu.', 'its tu big / tu smol'],
      ['How much is this?', '¿Cuánto cuesta esto?', 'Quanto custa isto?', 'Combien ça coûte ?', 'Quanto costa questo?', 'Wie viel kostet das?', 'これはいくらですか？', 'Kore wa ikura desu ka?', 'jáu mach is dis'],
      ['Is this on sale?', '¿Esto está en rebaja?', 'Isto está em promoção?', 'C’est en solde ?', 'È in saldo?', 'Ist das im Angebot?', 'これはセール中ですか？', 'Kore wa sēru-chū desu ka?', 'is dis on séil'],
      ['I\'ll take it.', 'Me lo llevo.', 'Vou levar.', 'Je le prends.', 'Lo prendo.', 'Ich nehme es.', 'これにします。', 'Kore ni shimasu.', 'áil téik it'],
      ['Can I return it if it doesn\'t fit?', '¿Puedo devolverlo si no me queda?', 'Posso devolver se não servir?', 'Je peux le rendre s’il ne me va pas ?', 'Posso restituirlo se non mi va bene?', 'Kann ich es zurückgeben, wenn es nicht passt?', '合わなかったら返品できますか？', 'Awanakattara henpin dekimasu ka?', 'kan ai ritérn it if it dásent fit'],
      ['Can I pay by card?', '¿Puedo pagar con tarjeta?', 'Posso pagar com cartão?', 'Je peux payer par carte ?', 'Posso pagare con la carta?', 'Kann ich mit Karte zahlen?', 'カードで払えますか？', 'Kādo de haraemasu ka?', 'kan ai péi bai kard']
    ].map(phrase)
  },
  {
    key: 'super',
    label: m('Supermercado'),
    icon: 'cart',
    tip: m('En la caja te preguntarán "Paper or plastic?" (bolsa de papel o plástico) y si quieres "cash back" (sacar efectivo). En muchas ciudades las bolsas se cobran.'),
    phrases: [
      ['Where can I find the water?', '¿Dónde encuentro el agua?', 'Onde encontro a água?', 'Où puis-je trouver l’eau ?', 'Dove trovo l’acqua?', 'Wo finde ich das Wasser?', '水はどこにありますか？', 'Mizu wa doko ni arimasu ka?', 'uér kan ai fáind de uóter'],
      ['Which aisle is the bread in?', '¿En qué pasillo está el pan?', 'Em que corredor fica o pão?', 'Dans quel rayon se trouve le pain ?', 'In quale corsia si trova il pane?', 'In welchem Gang ist das Brot?', 'パンはどの売り場ですか？', 'Pan wa dono uriba desu ka?', 'uích áil is de bred in'],
      ['Can I have a bag, please?', '¿Me da una bolsa, por favor?', 'Pode me dar uma sacola, por favor?', 'Je peux avoir un sac, s’il vous plaît ?', 'Posso avere un sacchetto, per favore?', 'Kann ich bitte eine Tüte haben?', '袋をください。', 'Fukuro o kudasai.', 'kan ai jav a bag, plis'],
      ['I don\'t need a bag, thanks.', 'No necesito bolsa, gracias.', 'Não preciso de sacola, obrigado.', 'Je n’ai pas besoin de sac, merci.', 'Non mi serve il sacchetto, grazie.', 'Ich brauche keine Tüte, danke.', '袋はいりません。', 'Fukuro wa irimasen.', 'ai dóunt nid a bag, zénks'],
      ['Can I get a receipt?', '¿Me da el recibo?', 'Pode me dar o recibo?', 'Je peux avoir le ticket de caisse ?', 'Posso avere lo scontrino?', 'Kann ich den Kassenbon haben?', 'レシートをください。', 'Reshīto o kudasai.', 'kan ai guet a risít'],
      ['Is there a pharmacy nearby?', '¿Hay una farmacia cerca?', 'Tem uma farmácia por perto?', 'Y a-t-il une pharmacie près d’ici ?', 'C’è una farmacia qui vicino?', 'Gibt es hier in der Nähe eine Apotheke?', '近くに薬局はありますか？', 'Chikaku ni yakkyoku wa arimasu ka?', 'is der a fármasi níerbai'],
      ['What time do you close?', '¿A qué hora cierran?', 'A que horas vocês fecham?', 'À quelle heure fermez-vous ?', 'A che ora chiudete?', 'Wann schließen Sie?', '何時に閉まりますか？', 'Nanji ni shimarimasu ka?', 'uat táim du iú klóus']
    ].map(phrase)
  },
  {
    key: 'transporte',
    label: m('Metro y transporte'),
    icon: 'train',
    tip: m('En Nueva York puedes pagar el metro acercando tu tarjeta o móvil al lector OMNY. "Uptown" es hacia el norte y "Downtown" hacia el sur. Los trenes "express" se saltan estaciones.'),
    phrases: [
      ['How do I get to the city center?', '¿Cómo llego al centro?', 'Como chego ao centro?', 'Comment aller au centre-ville ?', 'Come arrivo in centro?', 'Wie komme ich ins Stadtzentrum?', '中心街へはどう行けばいいですか？', 'Chūshingai e wa dō ikeba ii desu ka?', 'jáu du ai guet tu de síti sénter'],
      ['Which train goes to the airport?', '¿Qué tren va al aeropuerto?', 'Qual trem vai para o aeroporto?', 'Quel train va à l’aéroport ?', 'Quale treno va all’aeroporto?', 'Welcher Zug fährt zum Flughafen?', '空港行きの電車はどれですか？', 'Kūkō-yuki no densha wa dore desu ka?', 'uích tréin góus tu di érport'],
      ['Where can I buy a ticket?', '¿Dónde puedo comprar un billete?', 'Onde posso comprar uma passagem?', 'Où puis-je acheter un billet ?', 'Dove posso comprare un biglietto?', 'Wo kann ich eine Fahrkarte kaufen?', '切符はどこで買えますか？', 'Kippu wa doko de kaemasu ka?', 'uér kan ai bai a tíket'],
      ['Where is the nearest subway station?', '¿Dónde está la estación de metro más cercana?', 'Onde fica a estação de metrô mais próxima?', 'Où est la station de métro la plus proche ?', 'Dov’è la stazione della metro più vicina?', 'Wo ist die nächste U-Bahn-Station?', '一番近い地下鉄の駅はどこですか？', 'Ichiban chikai chikatetsu no eki wa doko desu ka?', 'uér is de níerest sábuei stéishon'],
      ['Does this bus stop downtown?', '¿Este autobús para en el centro?', 'Este ônibus para no centro?', 'Ce bus s’arrête-t-il au centre-ville ?', 'Questo autobus ferma in centro?', 'Hält dieser Bus im Zentrum?', 'このバスは中心街に止まりますか？', 'Kono basu wa chūshingai ni tomarimasu ka?', 'das dis bas stop dauntáun'],
      ['Can you take me to this address?', '¿Me lleva a esta dirección?', 'Pode me levar a este endereço?', 'Pouvez-vous m’emmener à cette adresse ?', 'Può portarmi a questo indirizzo?', 'Können Sie mich zu dieser Adresse bringen?', 'この住所までお願いします。', 'Kono jūsho made onegaishimasu.', 'kan iú téik mi tu dis ádres'],
      ['How long does it take?', '¿Cuánto se tarda?', 'Quanto tempo leva?', 'Combien de temps ça prend ?', 'Quanto tempo ci vuole?', 'Wie lange dauert es?', 'どのくらいかかりますか？', 'Dono kurai kakarimasu ka?', 'jáu long das it téik'],
      ['You can drop me off here.', 'Puede dejarme aquí.', 'Pode me deixar aqui.', 'Vous pouvez me déposer ici.', 'Può lasciarmi qui.', 'Sie können mich hier absetzen.', 'ここで降ります。', 'Koko de orimasu.', 'iú kan drop mi of jíer']
    ].map(phrase)
  },
  {
    key: 'direcciones',
    label: m('Direcciones'),
    icon: 'compass',
    tip: m('En Manhattan las calles (streets) van de este a oeste y las avenidas (avenues) de norte a sur. "Block" es una cuadra: te dirán "It\'s two blocks away".'),
    phrases: [
      ['Excuse me, where is…?', 'Disculpe, ¿dónde está…?', 'Com licença, onde fica…?', 'Excusez-moi, où se trouve… ?', 'Mi scusi, dov’è…?', 'Entschuldigung, wo ist…?', 'すみません、…はどこですか？', 'Sumimasen, … wa doko desu ka?', 'ekskiús mi, uér is…'],
      ['Is it far from here?', '¿Está lejos de aquí?', 'Fica longe daqui?', 'C’est loin d’ici ?', 'È lontano da qui?', 'Ist es weit von hier?', 'ここから遠いですか？', 'Koko kara tōi desu ka?', 'is it far from jíer'],
      ['Can I walk there?', '¿Se puede ir caminando?', 'Dá para ir a pé?', 'On peut y aller à pied ?', 'Ci si arriva a piedi?', 'Kann man zu Fuß dorthin gehen?', '歩いて行けますか？', 'Aruite ikemasu ka?', 'kan ai uók der'],
      ['Go straight and turn left.', 'Siga recto y gire a la izquierda.', 'Siga em frente e vire à esquerda.', 'Allez tout droit et tournez à gauche.', 'Vada dritto e giri a sinistra.', 'Gehen Sie geradeaus und biegen Sie links ab.', 'まっすぐ行って左に曲がってください。', 'Massugu itte hidari ni magatte kudasai.', 'góu stréit and tern left'],
      ['Turn right at the corner.', 'Gire a la derecha en la esquina.', 'Vire à direita na esquina.', 'Tournez à droite au coin de la rue.', 'Giri a destra all’angolo.', 'Biegen Sie an der Ecke rechts ab.', '角を右に曲がってください。', 'Kado o migi ni magatte kudasai.', 'tern ráit at de kórner'],
      ['Could you show me on the map?', '¿Me lo enseña en el mapa?', 'Pode me mostrar no mapa?', 'Pouvez-vous me montrer sur la carte ?', 'Può mostrarmelo sulla mappa?', 'Können Sie es mir auf der Karte zeigen?', '地図で教えてもらえますか？', 'Chizu de oshiete moraemasu ka?', 'kud iú shóu mi on de map'],
      ['I\'m lost.', 'Estoy perdido.', 'Estou perdido.', 'Je suis perdu.', 'Mi sono perso.', 'Ich habe mich verlaufen.', '道に迷いました。', 'Michi ni mayoimashita.', 'áim lost']
    ].map(phrase)
  },
  {
    key: 'hotel',
    label: m('Hotel'),
    icon: 'bed',
    tip: m('El check-in suele ser a las 3 p. m. y el check-out a las 11 a. m. Muchos hoteles cobran un "resort fee" o "facility fee" diario aparte; pregúntalo al llegar.'),
    phrases: [
      ['I have a reservation under the name…', 'Tengo una reserva a nombre de…', 'Tenho uma reserva em nome de…', 'J’ai une réservation au nom de…', 'Ho una prenotazione a nome…', 'Ich habe eine Reservierung auf den Namen…', '…の名前で予約しています。', '… no namae de yoyaku shite imasu.', 'ai jav a reservéishon ánder de néim…'],
      ['What time is check-out?', '¿A qué hora es la salida?', 'A que horas é o check-out?', 'À quelle heure faut-il libérer la chambre ?', 'A che ora è il check-out?', 'Wann muss ich auschecken?', 'チェックアウトは何時ですか？', 'Chekkuauto wa nanji desu ka?', 'uat táim is chek-áut'],
      ['Can we leave our bags here?', '¿Podemos dejar las maletas aquí?', 'Podemos deixar as malas aqui?', 'Pouvons-nous laisser nos bagages ici ?', 'Possiamo lasciare qui i bagagli?', 'Können wir unser Gepäck hier lassen?', '荷物を預かってもらえますか？', 'Nimotsu o azukatte moraemasu ka?', 'kan uí liv áuer bags jíer'],
      ['Is breakfast included?', '¿El desayuno está incluido?', 'O café da manhã está incluído?', 'Le petit-déjeuner est-il compris ?', 'La colazione è inclusa?', 'Ist das Frühstück inbegriffen?', '朝食は含まれていますか？', 'Chōshoku wa fukumarete imasu ka?', 'is brékfast inklúded'],
      ['Could I get some extra towels?', '¿Me da toallas extra?', 'Pode me dar mais toalhas?', 'Je pourrais avoir des serviettes en plus ?', 'Potrei avere altri asciugamani?', 'Könnte ich noch Handtücher bekommen?', 'タオルをもう少しいただけますか？', 'Taoru o mō sukoshi itadakemasu ka?', 'kud ai guet som ékstra táuels'],
      ['The air conditioning isn\'t working.', 'El aire acondicionado no funciona.', 'O ar-condicionado não está funcionando.', 'La climatisation ne marche pas.', 'L’aria condizionata non funziona.', 'Die Klimaanlage funktioniert nicht.', 'エアコンが動きません。', 'Eakon ga ugokimasen.', 'di er kondíshoning ísent uérking'],
      ['Can I get a late check-out?', '¿Puedo salir más tarde?', 'Posso fazer o check-out mais tarde?', 'Est-il possible de partir plus tard ?', 'Posso fare il check-out più tardi?', 'Kann ich später auschecken?', 'レイトチェックアウトはできますか？', 'Reito chekkuauto wa dekimasu ka?', 'kan ai guet a léit chek-áut']
    ].map(phrase)
  },
  {
    key: 'aeropuerto',
    label: m('Aeropuerto'),
    icon: 'plane',
    tip: m('En migración te preguntarán el motivo y la duración del viaje y dónde te alojas. Responde corto y claro, y ten a mano la dirección del hotel y el billete de vuelta.'),
    phrases: [
      ['I\'m here on vacation.', 'Estoy aquí de vacaciones.', 'Estou aqui de férias.', 'Je suis ici en vacances.', 'Sono qui in vacanza.', 'Ich mache hier Urlaub.', '観光で来ました。', 'Kankō de kimashita.', 'áim jíer on veikéishon'],
      ['I\'m staying for five days.', 'Me quedo cinco días.', 'Vou ficar cinco dias.', 'Je reste cinq jours.', 'Resto cinque giorni.', 'Ich bleibe fünf Tage.', '5日間滞在します。', 'Itsukakan taizai shimasu.', 'áim stéing for fáiv déis'],
      ['I\'m staying at a hotel downtown.', 'Me alojo en un hotel en el centro.', 'Estou hospedado em um hotel no centro.', 'Je loge dans un hôtel du centre-ville.', 'Alloggio in un hotel in centro.', 'Ich wohne in einem Hotel im Zentrum.', '中心街のホテルに泊まります。', 'Chūshingai no hoteru ni tomarimasu.', 'áim stéing at a joutél dauntáun'],
      ['Where is baggage claim?', '¿Dónde se recogen las maletas?', 'Onde fica a retirada de bagagem?', 'Où récupère-t-on les bagages ?', 'Dov’è il ritiro bagagli?', 'Wo ist die Gepäckausgabe?', '手荷物受取所はどこですか？', 'Tenimotsu uketorijo wa doko desu ka?', 'uér is bágadch kléim'],
      ['My luggage is missing.', 'Mi equipaje no ha llegado.', 'Minha bagagem não chegou.', 'Mes bagages ne sont pas arrivés.', 'Il mio bagaglio non è arrivato.', 'Mein Gepäck ist nicht angekommen.', '荷物が出てきません。', 'Nimotsu ga dete kimasen.', 'mai lágadch is mísing'],
      ['Where can I get a taxi?', '¿Dónde puedo tomar un taxi?', 'Onde posso pegar um táxi?', 'Où puis-je prendre un taxi ?', 'Dove posso prendere un taxi?', 'Wo bekomme ich ein Taxi?', 'タクシー乗り場はどこですか？', 'Takushī noriba wa doko desu ka?', 'uér kan ai guet a táksi'],
      ['Is this the line for check-in?', '¿Esta es la fila para facturar?', 'Esta é a fila do check-in?', 'C’est bien la file pour l’enregistrement ?', 'È questa la fila per il check-in?', 'Ist das die Schlange für den Check-in?', 'チェックインの列はここですか？', 'Chekkuin no retsu wa koko desu ka?', 'is dis de láin for chek-ín']
    ].map(phrase)
  },
  {
    key: 'pagar',
    label: m('Pagar y propinas'),
    icon: 'money',
    tip: m('Al pagar con tarjeta, la pantalla suele proponer 18 %, 20 % o 25 % de propina. En cafeterías de mostrador es opcional; en restaurantes con servicio en mesa se espera.'),
    phrases: [
      ['Do you take credit cards?', '¿Aceptan tarjeta de crédito?', 'Vocês aceitam cartão de crédito?', 'Vous acceptez les cartes de crédit ?', 'Accettate carte di credito?', 'Nehmen Sie Kreditkarten?', 'クレジットカードは使えますか？', 'Kurejitto kādo wa tsukaemasu ka?', 'du iú téik krédit kards'],
      ['Can I pay with my phone?', '¿Puedo pagar con el móvil?', 'Posso pagar com o celular?', 'Je peux payer avec mon téléphone ?', 'Posso pagare con il telefono?', 'Kann ich mit dem Handy bezahlen?', 'スマホで払えますか？', 'Sumaho de haraemasu ka?', 'kan ai péi wiz mai fóun'],
      ['Is the tip included?', '¿La propina está incluida?', 'A gorjeta está incluída?', 'Le service est-il compris ?', 'Il servizio è incluso?', 'Ist das Trinkgeld inbegriffen?', 'サービス料は含まれていますか？', 'Sābisu-ryō wa fukumarete imasu ka?', 'is de tip inklúded'],
      ['Keep the change.', 'Quédese con el cambio.', 'Pode ficar com o troco.', 'Gardez la monnaie.', 'Tenga il resto.', 'Stimmt so.', 'お釣りは結構です。', 'Otsuri wa kekkō desu.', 'kip de chéindch'],
      ['Could you give me change for this?', '¿Me puede cambiar este billete?', 'Pode trocar esta nota?', 'Pouvez-vous me faire de la monnaie ?', 'Può cambiarmi questa banconota?', 'Können Sie mir das wechseln?', 'これを両替できますか？', 'Kore o ryōgae dekimasu ka?', 'kud iú guiv mi chéindch for dis'],
      ['Is there an ATM nearby?', '¿Hay un cajero cerca?', 'Tem um caixa eletrônico por perto?', 'Y a-t-il un distributeur près d’ici ?', 'C’è un bancomat qui vicino?', 'Gibt es hier in der Nähe einen Geldautomaten?', '近くにATMはありますか？', 'Chikaku ni ē-tī-emu wa arimasu ka?', 'is der an ei-ti-ém níerbai']
    ].map(phrase)
  },
  {
    key: 'social',
    label: m('Charlar'),
    icon: 'users',
    tip: m('La conversación casual (small talk) es muy común: el clima, de dónde eres o qué te parece la ciudad. "What\'s up?" es un saludo informal; basta con responder "Not much!".'),
    phrases: [
      ['Where are you from?', '¿De dónde eres?', 'De onde você é?', 'D’où venez-vous ?', 'Di dove sei?', 'Woher kommen Sie?', 'どちらのご出身ですか？', 'Dochira no goshusshin desu ka?', 'uér ar iú from'],
      ['It\'s our first time here.', 'Es nuestra primera vez aquí.', 'É a nossa primeira vez aqui.', 'C’est notre première fois ici.', 'È la nostra prima volta qui.', 'Wir sind zum ersten Mal hier.', 'ここに来るのは初めてです。', 'Koko ni kuru no wa hajimete desu.', 'its áuer ferst táim jíer'],
      ['Can you take a picture of us?', '¿Nos puede tomar una foto?', 'Pode tirar uma foto nossa?', 'Pouvez-vous nous prendre en photo ?', 'Può farci una foto?', 'Können Sie ein Foto von uns machen?', '写真を撮ってもらえますか？', 'Shashin o totte moraemasu ka?', 'kan iú téik a píkcher of as'],
      ['Any recommendations around here?', '¿Alguna recomendación por aquí?', 'Alguma recomendação por aqui?', 'Vous avez des recommandations dans le coin ?', 'Ha qualche consiglio in zona?', 'Haben Sie Tipps für die Gegend?', 'この辺でおすすめはありますか？', 'Kono hen de osusume wa arimasu ka?', 'éni rekomendéishons aráund jíer'],
      ['Nice to meet you!', '¡Encantado de conocerte!', 'Prazer em conhecer você!', 'Enchanté !', 'Piacere di conoscerti!', 'Freut mich, Sie kennenzulernen!', 'はじめまして！', 'Hajimemashite!', 'náis tu mit iú'],
      ['That sounds great!', '¡Suena genial!', 'Parece ótimo!', 'Ça a l’air super !', 'Sembra fantastico!', 'Das klingt toll!', 'いいですね！', 'Ii desu ne!', 'dat sáunds gréit']
    ].map(phrase)
  },
  {
    key: 'emergencias',
    label: m('Emergencias y salud'),
    icon: 'alert',
    tip: m('El número de emergencias es el 911 (policía, bomberos y ambulancia). Para molestias leves, las "urgent care" son más rápidas y baratas que urgencias del hospital. Lleva siempre tu seguro de viaje.'),
    phrases: [
      ['Help!', '¡Ayuda!', 'Socorro!', 'Au secours !', 'Aiuto!', 'Hilfe!', '助けて！', 'Tasukete!', 'jelp'],
      ['Please call an ambulance.', 'Por favor, llame a una ambulancia.', 'Por favor, chame uma ambulância.', 'Appelez une ambulance, s’il vous plaît.', 'Per favore, chiami un’ambulanza.', 'Bitte rufen Sie einen Krankenwagen.', '救急車を呼んでください。', 'Kyūkyūsha o yonde kudasai.', 'plis kol an ámbiulans'],
      ['I need a doctor.', 'Necesito un médico.', 'Preciso de um médico.', 'J’ai besoin d’un médecin.', 'Ho bisogno di un medico.', 'Ich brauche einen Arzt.', '医者が必要です。', 'Isha ga hitsuyō desu.', 'ai nid a dóktor'],
      ['I lost my passport.', 'He perdido mi pasaporte.', 'Perdi meu passaporte.', 'J’ai perdu mon passeport.', 'Ho perso il passaporto.', 'Ich habe meinen Reisepass verloren.', 'パスポートをなくしました。', 'Pasupōto o nakushimashita.', 'ai lost mai pásport'],
      ['Someone stole my wallet.', 'Me han robado la cartera.', 'Roubaram minha carteira.', 'On m’a volé mon portefeuille.', 'Mi hanno rubato il portafoglio.', 'Jemand hat mein Portemonnaie gestohlen.', '財布を盗まれました。', 'Saifu o nusumaremashita.', 'sámuan stóul mai uálet'],
      ['Where is the nearest hospital?', '¿Dónde está el hospital más cercano?', 'Onde fica o hospital mais próximo?', 'Où est l’hôpital le plus proche ?', 'Dov’è l’ospedale più vicino?', 'Wo ist das nächste Krankenhaus?', '一番近い病院はどこですか？', 'Ichiban chikai byōin wa doko desu ka?', 'uér is de níerest jóspital'],
      ['I have travel insurance.', 'Tengo seguro de viaje.', 'Tenho seguro de viagem.', 'J’ai une assurance voyage.', 'Ho un’assicurazione di viaggio.', 'Ich habe eine Reiseversicherung.', '旅行保険に入っています。', 'Ryokō hoken ni haitte imasu.', 'ai jav trável inshúrans'],
      ['Do you have something for a headache?', '¿Tiene algo para el dolor de cabeza?', 'Tem algo para dor de cabeça?', 'Avez-vous quelque chose contre le mal de tête ?', 'Ha qualcosa per il mal di testa?', 'Haben Sie etwas gegen Kopfschmerzen?', '頭痛薬はありますか？', 'Zutsūyaku wa arimasu ka?', 'du iú jav sámzing for a jédeik']
    ].map(phrase)
  }
];
