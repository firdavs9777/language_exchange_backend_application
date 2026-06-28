/**
 * Migration: seed the Exam Study Vocabulary word bank.
 *
 * Idempotent — re-runs without duplicating (dedup by (languageId, word)).
 *
 * Also creates the per-exam 'vocabulary' ExamSection rows if they don't
 * exist yet, so the dashboard can render a Vocabulary tile.
 *
 * Usage:
 *   node migrations/seedExamVocab.js
 */

require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');

const ExamLanguage = require('../models/ExamLanguage');
const ExamType = require('../models/ExamType');
const ExamSection = require('../models/ExamSection');
const ExamVocabularyWord = require('../models/ExamVocabularyWord');

const WORD_DATA = [
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'itinerary', definition: 'a planned route or schedule for a trip', exampleSentence: 'Our itinerary includes two days in Rome and one in Florence.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'luggage', definition: 'the bags and suitcases a traveller carries', exampleSentence: 'I packed light, so my luggage was easy to carry.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'departure', definition: 'the act of leaving a place, especially on a journey', exampleSentence: 'Our departure was delayed by two hours because of the storm.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'destination', definition: 'the place a person or thing is going to', exampleSentence: 'Tokyo was the most exciting destination on our tour.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'colleague', definition: 'a person you work with', exampleSentence: 'My colleagues helped me finish the report on time.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'schedule', definition: 'a plan of work or activities at set times', exampleSentence: 'I added the meeting to my schedule for tomorrow.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'salary', definition: 'the money you are paid each month for working', exampleSentence: 'She earns a higher salary in her new job.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'interview', definition: 'a formal meeting to assess a candidate for a job', exampleSentence: 'I have an interview for an internship next week.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'subject', definition: 'an area of knowledge taught in school', exampleSentence: 'History is my favourite subject this year.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'textbook', definition: 'a book used for studying a subject', exampleSentence: 'Please open your textbook to page 42.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'homework', definition: 'schoolwork given to be done at home', exampleSentence: 'I have a lot of homework to finish tonight.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'classmate', definition: 'a person in the same class as you', exampleSentence: 'My classmates and I are working on a group project.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'exercise', definition: 'physical activity done to stay healthy', exampleSentence: 'Daily exercise helps me feel more energetic.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'symptom', definition: 'a sign that you have an illness', exampleSentence: 'A sore throat is often the first symptom of a cold.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'medicine', definition: 'a substance used to treat illness', exampleSentence: 'Take this medicine twice a day after meals.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'appointment', definition: 'an arranged meeting, often with a doctor', exampleSentence: 'I made an appointment with my dentist for next Monday.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'device', definition: 'a piece of equipment made for a specific purpose', exampleSentence: 'My new device can record video in very high quality.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Technology', partOfSpeech: 'verb', word: 'download', definition: 'to transfer a file from the internet to your computer', exampleSentence: 'Please download the file before the meeting starts.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'battery', definition: 'a container that stores electric power', exampleSentence: 'My phone battery dies very quickly these days.' },
  { langCode: 'en', examCode: 'IELTS', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'password', definition: 'a secret word used to access a computer or account', exampleSentence: 'Choose a password that is easy to remember but hard to guess.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'accommodation', definition: 'a place where travellers can stay', exampleSentence: 'Affordable accommodation is hard to find during the festival.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'excursion', definition: 'a short trip taken for pleasure', exampleSentence: 'We booked an excursion to the ancient ruins.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'souvenir', definition: 'an object kept as a reminder of a place', exampleSentence: 'She brought back a small souvenir from every country she visited.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'currency', definition: 'the system of money used in a country', exampleSentence: 'You should exchange currency before leaving the airport.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'deadline', definition: 'the latest time something must be completed', exampleSentence: 'We have a tight deadline for the new product launch.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'promotion', definition: 'a move to a more important job', exampleSentence: 'After two years of hard work, she got a promotion.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'workload', definition: 'the amount of work to be done by a person', exampleSentence: 'My workload has doubled since the team got smaller.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Work', partOfSpeech: 'verb', word: 'commute', definition: 'to travel regularly between home and work', exampleSentence: 'I commute to the office by train every morning.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'curriculum', definition: 'the subjects studied in a school or course', exampleSentence: 'The new curriculum places more emphasis on science.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'scholarship', definition: 'money given to a student to support studies', exampleSentence: 'He won a scholarship that covered his tuition fees.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'assignment', definition: 'a task given as part of a course', exampleSentence: 'Our final assignment is to write a 2,000-word essay.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'plagiarism', definition: 'using another person\'s work without crediting them', exampleSentence: 'The professor warned us that plagiarism would result in expulsion.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: 'nutrition', definition: 'the process of getting the food needed for health', exampleSentence: 'Good nutrition is essential for children\'s development.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Health', partOfSpeech: 'adjective', word: 'immune', definition: 'able to resist a particular disease', exampleSentence: 'A balanced diet helps keep your immune system strong.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Health', partOfSpeech: 'verb', word: 'recover', definition: 'to return to a normal state of health', exampleSentence: 'It took him a month to recover from the flu.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: 'prescription', definition: 'an instruction written by a doctor to obtain medicine', exampleSentence: 'The pharmacist filled my prescription in ten minutes.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: 'software', definition: 'the programs used by a computer', exampleSentence: 'Our team relies on specialised software for design work.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: 'interface', definition: 'the way a user interacts with a system', exampleSentence: 'The app\'s interface is clean and easy to navigate.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: 'storage', definition: 'the space available to keep data', exampleSentence: 'Cloud storage saved me when my laptop crashed.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B1', topic: 'Technology', partOfSpeech: 'verb', word: 'update', definition: 'to make something more modern or accurate', exampleSentence: 'Please update your contact details before logging out.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: 'itineraries', definition: 'planned routes or schedules for trips', exampleSentence: 'Travel agents prepare detailed itineraries for their clients.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Travel', partOfSpeech: 'adjective', word: 'sustainable', definition: 'able to continue without harming the environment', exampleSentence: 'Eco-lodges promote sustainable tourism practices.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: 'logistics', definition: 'the detailed organisation of a complex operation', exampleSentence: 'The logistics of moving a hundred people across borders were daunting.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Travel', partOfSpeech: 'adjective', word: 'immersive', definition: 'deeply involving the senses or attention', exampleSentence: 'The homestay was an immersive cultural experience.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Work', partOfSpeech: 'verb', word: 'delegate', definition: 'to give a task or responsibility to someone else', exampleSentence: 'Good managers know when to delegate and when to intervene.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: 'morale', definition: 'the level of confidence in a group', exampleSentence: 'Team morale dropped after the round of layoffs.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Work', partOfSpeech: 'adjective', word: 'freelance', definition: 'working for different companies independently', exampleSentence: 'She left her corporate job to go freelance.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: 'perks', definition: 'extra benefits given to an employee', exampleSentence: 'The role offers generous perks, including remote work.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Education', partOfSpeech: 'adjective', word: 'rigorous', definition: 'extremely thorough and careful', exampleSentence: 'Engineering programmes are known for their rigorous coursework.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Education', partOfSpeech: 'adjective', word: 'interdisciplinary', definition: 'involving more than one academic field', exampleSentence: 'She enrolled in an interdisciplinary programme combining biology and design.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: 'dissertation', definition: 'a long essay on a research topic for a degree', exampleSentence: 'He spent two years writing his doctoral dissertation.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: 'pedagogy', definition: 'the method and practice of teaching', exampleSentence: 'Modern pedagogy focuses on active student participation.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Health', partOfSpeech: 'adjective', word: 'chronic', definition: 'lasting a long time, recurring', exampleSentence: 'Chronic back pain can severely affect quality of life.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Health', partOfSpeech: 'adjective', word: 'preventive', definition: 'designed to stop something from happening', exampleSentence: 'Preventive care is often cheaper than treatment.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: 'rehabilitation', definition: 'the process of recovering from illness or injury', exampleSentence: 'Her rehabilitation after the surgery took several months.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: 'epidemic', definition: 'a widespread occurrence of a disease', exampleSentence: 'The flu epidemic disrupted schools across the region.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'algorithm', definition: 'a step-by-step procedure for solving a problem', exampleSentence: 'The recommendation algorithm learns from your viewing history.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'cybersecurity', definition: 'the practice of protecting systems from digital attacks', exampleSentence: 'Cybersecurity has become a top priority for every bank.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'encryption', definition: 'the process of converting data into a code', exampleSentence: 'End-to-end encryption keeps private messages private.' },
  { langCode: 'en', examCode: 'IELTS', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'automation', definition: 'the use of machines to perform tasks without human help', exampleSentence: 'Automation is transforming both manufacturing and white-collar work.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'equipaje', definition: 'las maletas y bolsas que lleva un viajero', exampleSentence: 'El equipaje no debe pesar más de 23 kilos.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'vuelo', definition: 'viaje en avión', exampleSentence: 'Nuestro vuelo a Madrid sale a las ocho de la mañana.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'billete', definition: 'papel que permite viajar en transporte público', exampleSentence: 'Compré un billete de tren para Barcelona.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: 'estación', definition: 'lugar donde paran trenes o autobuses', exampleSentence: 'Te espero en la estación a las tres.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'compañero', definition: 'persona con quien trabajamos', exampleSentence: 'Mis compañeros de oficina son muy amables.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'sueldo', definition: 'dinero que se cobra por un trabajo', exampleSentence: 'Su sueldo aumentará el próximo año.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'oficina', definition: 'lugar donde se trabaja', exampleSentence: 'Voy a la oficina en metro todos los días.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: 'reunión', definition: 'encuentro de personas para hablar de trabajo', exampleSentence: 'Tenemos una reunión importante el viernes.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'asignatura', definition: 'materia que se estudia en la escuela', exampleSentence: 'Mi asignatura favorita es la historia.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'examen', definition: 'prueba para evaluar lo aprendido', exampleSentence: 'Estudié mucho para el examen de matemáticas.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'apuntes', definition: 'notas escritas durante una clase', exampleSentence: 'Le pedí los apuntes a mi compañero.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: 'biblioteca', definition: 'lugar con libros para leer o estudiar', exampleSentence: 'La biblioteca cierra a las nueve de la noche.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'medicina', definition: 'sustancia para tratar enfermedades', exampleSentence: 'Toma esta medicina dos veces al día.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'dolor', definition: 'sensación física desagradable', exampleSentence: 'Tengo dolor de cabeza desde esta mañana.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'hospital', definition: 'lugar donde se atiende a los enfermos', exampleSentence: 'Mi tía trabaja en un hospital del centro.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: 'cita', definition: 'encuentro acordado con alguien', exampleSentence: 'Tengo cita con el dentista mañana.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'móvil', definition: 'teléfono que se lleva encima', exampleSentence: 'Mi móvil tiene una cámara muy buena.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'ordenador', definition: 'máquina para procesar información', exampleSentence: 'Necesito un ordenador nuevo para la universidad.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'contraseña', definition: 'palabra secreta para acceder a algo', exampleSentence: 'No olvides cambiar tu contraseña con frecuencia.' },
  { langCode: 'es', examCode: 'DELE', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: 'pantalla', definition: 'superficie donde se ve la imagen', exampleSentence: 'La pantalla de mi tableta es muy clara.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'alojamiento', definition: 'lugar donde se hospeda un viajero', exampleSentence: 'Buscamos alojamiento cerca del centro histórico.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'itinerario', definition: 'plan detallado de un viaje', exampleSentence: 'El itinerario incluye tres ciudades en una semana.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'aduana', definition: 'lugar donde se controlan las mercancías al cruzar la frontera', exampleSentence: 'En la aduana revisaron todas nuestras maletas.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: 'retraso', definition: 'tiempo de demora', exampleSentence: 'El tren llegó con una hora de retraso.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'plazo', definition: 'tiempo límite para hacer algo', exampleSentence: 'El plazo para entregar el informe vence el lunes.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'ascenso', definition: 'subida a un puesto superior', exampleSentence: 'Después de tres años obtuvo un ascenso.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'currículum', definition: 'documento con la experiencia profesional', exampleSentence: 'Adjunto mi currículum actualizado a este correo.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: 'teletrabajo', definition: 'trabajo realizado desde casa', exampleSentence: 'El teletrabajo ha cambiado nuestra rutina.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'matrícula', definition: 'inscripción en un curso o universidad', exampleSentence: 'La matrícula del semestre debe pagarse antes del 1 de septiembre.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'beca', definition: 'ayuda económica para estudiar', exampleSentence: 'Solicitó una beca para estudiar en el extranjero.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'trabajo', definition: 'tarea académica asignada', exampleSentence: 'Tenemos que entregar un trabajo de diez páginas.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: 'docente', definition: 'persona que enseña', exampleSentence: 'El docente explicó el tema con mucha paciencia.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: 'síntoma', definition: 'señal de una enfermedad', exampleSentence: 'La fiebre puede ser síntoma de muchas enfermedades.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: 'receta', definition: 'instrucción escrita por un médico', exampleSentence: 'Sin receta no puedo comprar este medicamento.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: 'ejercicio', definition: 'actividad física regular', exampleSentence: 'El ejercicio diario mejora la salud cardiovascular.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: 'vacuna', definition: 'preparado que protege contra una enfermedad', exampleSentence: 'La vacuna anual contra la gripe es muy recomendable.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: 'aplicación', definition: 'programa informático con un propósito específico', exampleSentence: 'Esta aplicación me ayuda a aprender idiomas.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Technology', partOfSpeech: 'verb', word: 'descargar', definition: 'obtener un archivo de internet', exampleSentence: 'Voy a descargar la película antes del viaje.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: 'nube', definition: 'almacenamiento de datos en internet', exampleSentence: 'Tengo todas mis fotos guardadas en la nube.' },
  { langCode: 'es', examCode: 'DELE', level: 'B1', topic: 'Technology', partOfSpeech: 'verb', word: 'actualizar', definition: 'renovar o poner al día', exampleSentence: 'Recuerda actualizar el sistema operativo cada mes.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Travel', partOfSpeech: 'adjective', word: 'imprescindible', definition: 'absolutamente necesario', exampleSentence: 'Llevar un seguro de viaje es imprescindible.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: 'desplazamiento', definition: 'movimiento de un lugar a otro', exampleSentence: 'El desplazamiento entre ciudades fue cómodo en tren.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Travel', partOfSpeech: 'adjective', word: 'autóctono', definition: 'originario del lugar', exampleSentence: 'Probamos varios platos autóctonos durante el viaje.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: 'trayecto', definition: 'camino o recorrido entre dos lugares', exampleSentence: 'El trayecto en coche dura unas seis horas.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Work', partOfSpeech: 'verb', word: 'delegar', definition: 'encargar una tarea a otra persona', exampleSentence: 'Un buen líder sabe delegar responsabilidades.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Work', partOfSpeech: 'adjective', word: 'polivalente', definition: 'que sirve para varias cosas', exampleSentence: 'Buscan a alguien polivalente para el equipo.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: 'conciliación', definition: 'equilibrio entre vida laboral y personal', exampleSentence: 'La empresa promueve la conciliación familiar.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: 'emprendimiento', definition: 'iniciativa de crear un negocio', exampleSentence: 'Su emprendimiento creció rápidamente en dos años.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: 'tesina', definition: 'trabajo escrito al final de unos estudios', exampleSentence: 'Defendió su tesina con muy buena nota.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: 'itinerario', definition: 'trayectoria académica elegida', exampleSentence: 'Elegí un itinerario centrado en literatura comparada.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: 'pedagogía', definition: 'ciencia que estudia la enseñanza', exampleSentence: 'La pedagogía moderna favorece el aprendizaje activo.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: 'evaluación', definition: 'proceso de medir conocimientos', exampleSentence: 'La evaluación continua reduce el peso del examen final.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Health', partOfSpeech: 'adjective', word: 'crónico', definition: 'que dura mucho tiempo', exampleSentence: 'El asma es una enfermedad crónica que requiere control.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: 'prevención', definition: 'medidas para evitar un problema', exampleSentence: 'La prevención es más eficaz que el tratamiento.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: 'rehabilitación', definition: 'proceso para recuperar la salud', exampleSentence: 'Su rehabilitación tras la operación duró tres meses.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: 'dolencia', definition: 'molestia o enfermedad', exampleSentence: 'Las dolencias de espalda son muy comunes en oficinistas.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'algoritmo', definition: 'secuencia de pasos para resolver un problema', exampleSentence: 'Los algoritmos de recomendación aprenden de nuestros hábitos.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'ciberseguridad', definition: 'protección de sistemas digitales', exampleSentence: 'La ciberseguridad es prioritaria para los bancos.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: 'automatización', definition: 'uso de máquinas para realizar tareas', exampleSentence: 'La automatización está transformando muchos sectores.' },
  { langCode: 'es', examCode: 'DELE', level: 'B2', topic: 'Technology', partOfSpeech: 'adjective', word: 'inalámbrico', definition: 'que no usa cables', exampleSentence: 'Compré unos auriculares inalámbricos muy ligeros.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: '여행', definition: '다른 곳으로 가는 일', exampleSentence: '이번 휴가에 가족 여행을 갈 거예요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: '공항', definition: '비행기를 타는 곳', exampleSentence: '공항까지 택시로 갔어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: '호텔', definition: '여행 중 묵는 곳', exampleSentence: '호텔 방이 깨끗하고 넓어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Travel', partOfSpeech: 'noun', word: '표', definition: '탈것이나 입장권에 쓰는 종이', exampleSentence: '기차 표를 미리 사 두는 게 좋아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: '회사', definition: '사람들이 모여 일하는 곳', exampleSentence: '회사 근처에 카페가 많아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: '회의', definition: '여러 사람이 모여 이야기하는 것', exampleSentence: '오후에 중요한 회의가 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: '월급', definition: '한 달마다 받는 돈', exampleSentence: '월급으로 생활비를 내요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Work', partOfSpeech: 'noun', word: '동료', definition: '함께 일하는 사람', exampleSentence: '동료들과 점심을 같이 먹어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: '학교', definition: '공부하는 곳', exampleSentence: '동생이 새 학교에 다녀요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: '숙제', definition: '집에서 하는 학교 공부', exampleSentence: '오늘 숙제가 너무 많아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: '시험', definition: '지식을 평가하는 일', exampleSentence: '내일 영어 시험이 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Education', partOfSpeech: 'noun', word: '교실', definition: '학생들이 공부하는 방', exampleSentence: '교실 안이 조용해요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: '병원', definition: '아픈 사람을 치료하는 곳', exampleSentence: '감기에 걸려서 병원에 갔어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: '약', definition: '병을 치료하는 것', exampleSentence: '이 약은 하루에 두 번 드세요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: '운동', definition: '몸을 움직여 건강을 지키는 일', exampleSentence: '저는 매일 아침 운동을 해요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Health', partOfSpeech: 'noun', word: '의사', definition: '병을 치료하는 사람', exampleSentence: '의사 선생님이 친절하셨어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: '컴퓨터', definition: '정보를 처리하는 기계', exampleSentence: '새 컴퓨터를 한 대 샀어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: '휴대폰', definition: '가지고 다니는 전화기', exampleSentence: '휴대폰 배터리가 빨리 닳아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: '인터넷', definition: '온라인 네트워크', exampleSentence: '인터넷으로 영화를 봐요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'A2', topic: 'Technology', partOfSpeech: 'noun', word: '이메일', definition: '전자 우편', exampleSentence: '이메일을 확인해 주세요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: '숙소', definition: '여행 중 머무는 장소', exampleSentence: '이번 여행은 숙소를 일찍 예약했어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: '여권', definition: '외국에 가기 위한 신분증', exampleSentence: '여권 유효기간을 미리 확인하세요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: '관광지', definition: '구경하러 가는 장소', exampleSentence: '이 도시는 유명한 관광지가 많아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Travel', partOfSpeech: 'noun', word: '환전', definition: '돈을 다른 나라 돈으로 바꾸는 일', exampleSentence: '공항에서 환전을 했어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: '마감', definition: '일을 끝내야 하는 시간', exampleSentence: '이번 보고서의 마감은 금요일이에요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: '승진', definition: '더 높은 자리에 오르는 것', exampleSentence: '열심히 일한 끝에 승진했어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: '출장', definition: '업무로 다른 곳에 가는 일', exampleSentence: '다음 주에 일본으로 출장을 가요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Work', partOfSpeech: 'noun', word: '이력서', definition: '경력을 쓴 문서', exampleSentence: '이력서에 자격증을 추가했어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: '전공', definition: '주로 공부하는 과목', exampleSentence: '제 전공은 경영학이에요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: '장학금', definition: '공부를 돕기 위해 주는 돈', exampleSentence: '성적이 좋아서 장학금을 받았어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: '강의', definition: '수업이나 강연', exampleSentence: '이 강의는 일주일에 두 번 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Education', partOfSpeech: 'noun', word: '과제', definition: '주어진 학습 일', exampleSentence: '이번 주말에 과제를 끝내야 해요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: '증상', definition: '병의 표시', exampleSentence: '이런 증상이 며칠째 계속되고 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: '처방전', definition: '의사가 약을 정해 주는 문서', exampleSentence: '처방전을 받아서 약국에 갔어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: '면역', definition: '병에 잘 안 걸리는 힘', exampleSentence: '잠을 잘 자야 면역력이 좋아져요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Health', partOfSpeech: 'noun', word: '회복', definition: '건강이 다시 좋아지는 것', exampleSentence: '수술 후 회복에 두 달이 걸렸어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: '앱', definition: '스마트폰에서 쓰는 프로그램', exampleSentence: '이 앱은 한국어 공부에 좋아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: '저장', definition: '데이터를 보관하는 것', exampleSentence: '사진을 클라우드에 저장했어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: '업데이트', definition: '최신 상태로 만드는 일', exampleSentence: '앱을 업데이트해 주세요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B1', topic: 'Technology', partOfSpeech: 'noun', word: '비밀번호', definition: '남이 모르게 정한 글자', exampleSentence: '비밀번호를 자주 바꾸는 게 좋아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: '일정', definition: '정해진 계획표', exampleSentence: '출장 일정을 미리 공유했어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: '체류', definition: '어느 곳에 머무는 것', exampleSentence: '장기 체류 비자가 필요해요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: '교통편', definition: '이동하는 방법', exampleSentence: '교통편이 편리해서 도착이 쉬워요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Travel', partOfSpeech: 'noun', word: '관광객', definition: '구경하러 온 사람', exampleSentence: '이 도시는 외국인 관광객이 많아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: '협업', definition: '여러 사람이 같이 일하는 것', exampleSentence: '부서 간 협업이 중요한 프로젝트예요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: '실적', definition: '일의 성과', exampleSentence: '올해 영업 실적이 작년보다 좋아요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: '재택근무', definition: '집에서 일하는 것', exampleSentence: '재택근무가 일상이 되었어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Work', partOfSpeech: 'noun', word: '성과급', definition: '성과에 따라 받는 돈', exampleSentence: '성과급은 분기마다 지급돼요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: '논문', definition: '연구 결과를 쓴 글', exampleSentence: '박사 논문을 마무리하고 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: '교과 과정', definition: '공부할 내용의 전체 계획', exampleSentence: '교과 과정이 작년부터 바뀌었어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: '진학', definition: '더 높은 학교로 가는 것', exampleSentence: '대학원 진학을 준비하고 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Education', partOfSpeech: 'noun', word: '평가', definition: '값어치를 따져 매기는 것', exampleSentence: '기말 평가는 발표로 진행됩니다.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Health', partOfSpeech: 'adjective', word: '만성', definition: '오래 지속되는', exampleSentence: '만성 두통으로 병원에 다녀요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: '예방', definition: '미리 막는 일', exampleSentence: '예방 접종이 가장 효과적인 방법이에요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: '재활', definition: '다친 후 회복하는 과정', exampleSentence: '재활 치료를 꾸준히 받고 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Health', partOfSpeech: 'noun', word: '스트레스', definition: '정신적인 압박', exampleSentence: '스트레스가 건강에 큰 영향을 줍니다.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: '알고리즘', definition: '문제 해결을 위한 절차', exampleSentence: '추천 알고리즘이 사용자의 취향을 학습해요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: '보안', definition: '위험으로부터 지키는 것', exampleSentence: '보안 패치는 가능한 한 빨리 적용하세요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: '자동화', definition: '기계가 일을 대신하는 것', exampleSentence: '공장에서 자동화가 빠르게 진행되고 있어요.' },
  { langCode: 'ko', examCode: 'TOPIK', level: 'B2', topic: 'Technology', partOfSpeech: 'noun', word: '암호화', definition: '정보를 알아볼 수 없게 만드는 것', exampleSentence: '메신저의 종단간 암호화가 사생활을 보호해요.' },
];

const VOCAB_SECTION_DATA = [
  { examCode: 'IELTS', sectionName: 'Vocabulary', sectionType: 'vocabulary', questionCount: 0 },
  { examCode: 'DELE',  sectionName: 'Vocabulario', sectionType: 'vocabulary', questionCount: 0 },
  { examCode: 'TOPIK', sectionName: '어휘', sectionType: 'vocabulary', questionCount: 0 },
];

async function seed() {
  console.log('\u{1f504} Connecting to MongoDB\u2026');
  await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
    maxPoolSize: 10,
  });
  console.log('\u2705 Connected');

  const langByCode = {};
  for (const code of ['en', 'es', 'ko']) {
    const lang = await ExamLanguage.findOne({ code });
    if (!lang) throw new Error(`Language ${code} not found — run seedExamStudy.js first`);
    langByCode[code] = lang;
  }

  const examByCode = {};
  for (const code of ['IELTS', 'DELE', 'TOPIK']) {
    const exam = await ExamType.findOne({ code });
    if (!exam) throw new Error(`Exam ${code} not found — run seedExamStudy.js first`);
    examByCode[code] = exam;
  }

  // 1. Ensure each exam has a Vocabulary section row.
  for (const data of VOCAB_SECTION_DATA) {
    const exam = examByCode[data.examCode];
    let section = await ExamSection.findOne({ examId: exam._id, sectionType: 'vocabulary' });
    if (!section) {
      section = await ExamSection.create({
        examId: exam._id,
        sectionName: data.sectionName,
        sectionType: 'vocabulary',
        questionCount: 0,
      });
      console.log(`+ Created ${data.examCode}/vocabulary section`);
    } else {
      console.log(`= ${data.examCode}/vocabulary already exists`);
    }
    // Make sure the section is referenced on the parent ExamType.
    await ExamType.updateOne(
      { _id: exam._id },
      { $addToSet: { sections: 'vocabulary' } },
    );
  }

  // 2. Insert word documents (skip duplicates by language+word).
  let created = 0;
  let skipped = 0;
  for (const w of WORD_DATA) {
    const lang = langByCode[w.langCode];
    const exam = examByCode[w.examCode];
    const exists = await ExamVocabularyWord.findOne({
      languageId: lang._id,
      word: w.word,
    });
    if (exists) {
      // Add this exam to examIds if not already there.
      if (!exists.examIds.some(id => String(id) === String(exam._id))) {
        exists.examIds.push(exam._id);
        await exists.save();
      }
      skipped += 1;
      continue;
    }
    await ExamVocabularyWord.create({
      word: w.word,
      languageId: lang._id,
      examIds: [exam._id],
      level: w.level,
      topic: w.topic,
      partOfSpeech: w.partOfSpeech,
      definition: w.definition,
      exampleSentence: w.exampleSentence,
    });
    created += 1;
  }

  console.log(`+ Created ${created} vocabulary words (${skipped} already existed)`);
  console.log('\u2705 Seed complete');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
