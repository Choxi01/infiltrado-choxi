// Lugares de El Espía (V2): todos los ven menos el espía. Cada uno con 6 a 10 roles.
// La lista completa es pública durante la partida: el espía la puede mirar sin delatarse.
(function (raiz) {
  "use strict";
  const LUGARES = [
    { lugar: "Hospital", roles: ["Médica", "Paciente", "Enfermero", "Cirujana", "Visita", "Recepcionista", "Camillero", "Anestesista"] },
    { lugar: "Escuela", roles: ["Maestra", "Alumno", "Director", "Portero", "Mamá", "Profe de gimnasia", "Cantinera"] },
    { lugar: "Avión", roles: ["Piloto", "Azafata", "Pasajero", "Copiloto", "Bebé que llora", "Pasajero con miedo", "Mecánico"] },
    { lugar: "Banco", roles: ["Cajero", "Gerente", "Cliente", "Guardia", "Ladrón", "Asesor de créditos"] },
    { lugar: "Playa", roles: ["Bañero", "Turista", "Vendedor de helados", "Surfista", "Nene haciendo castillos", "Fotógrafo"] },
    { lugar: "Restaurante", roles: ["Mozo", "Cocinero", "Cliente", "Crítico gastronómico", "Cajera", "Lavaplatos", "Músico"] },
    { lugar: "Supermercado", roles: ["Cajera", "Repositor", "Cliente", "Guardia", "Carnicero", "Gerente", "Promotora"] },
    { lugar: "Cine", roles: ["Boletero", "Espectador", "Vendedor de pochoclo", "Pareja", "Limpiador", "Proyectorista"] },
    { lugar: "Comisaría", roles: ["Comisario", "Detenido", "Oficial", "Abogado", "Denunciante", "Periodista"] },
    { lugar: "Cancha un domingo", roles: ["Hincha", "Árbitro", "Jugador", "Vendedor de chipa", "Policía", "Periodista", "Técnico", "Barra brava"] },
    { lugar: "Terminal de ómnibus", roles: ["Chofer", "Pasajero", "Vendedor de chipa", "Boletero", "Maletero", "Turista", "Policía"] },
    { lugar: "Shopping", roles: ["Vendedora", "Cliente", "Guardia", "Nene perdido", "Mamá con cochecito", "Empleado del patio de comidas", "Limpiador"] },
    { lugar: "Colectivo de línea", roles: ["Chofer", "Pasajero sentado", "Pasajero parado", "Vendedor ambulante", "Estudiante", "Abuela", "Músico"] },
    { lugar: "Mercado", roles: ["Vendedora de frutas", "Cliente", "Carretillero", "Carnicero", "Turista", "Cuidacoches", "Yuyera"] },
    { lugar: "Circo", roles: ["Payaso", "Trapecista", "Domador", "Malabarista", "Espectador", "Mago", "Vendedor de algodón de azúcar"] },
    { lugar: "Iglesia", roles: ["Cura", "Monaguillo", "Fiel", "Novia", "Novio", "Coro", "Sacristán"] },
    { lugar: "Hotel", roles: ["Recepcionista", "Huésped", "Botones", "Mucama", "Gerente", "Turista", "Cocinero"] },
    { lugar: "Peluquería", roles: ["Peluquera", "Cliente", "Manicura", "Barbero", "Recepcionista", "Cliente esperando"] },
    { lugar: "Gimnasio", roles: ["Entrenador", "Fisicoculturista", "Recepcionista", "Principiante", "Profe de spinning", "Nutricionista"] },
    { lugar: "Fiesta de 15", roles: ["Quinceañera", "Papá", "DJ", "Mozo", "Invitada", "Fotógrafo", "Chambelán", "Abuela"] },
    { lugar: "Casamiento", roles: ["Novia", "Novio", "Padrino", "Invitado pasado de copas", "Fotógrafo", "DJ", "Suegra", "Mozo"] },
    { lugar: "Crucero", roles: ["Capitán", "Turista", "Animador", "Cocinero", "Marinero", "Mozo", "Músico"] },
    { lugar: "Submarino", roles: ["Capitán", "Cocinero", "Operador de radar", "Marinero", "Ingeniero", "Soldado"] },
    { lugar: "Estación espacial", roles: ["Astronauta", "Comandante", "Ingeniero", "Científica", "Médico", "Turista espacial"] },
    { lugar: "Zoológico", roles: ["Cuidador", "Veterinario", "Visitante", "Nene", "Fotógrafo", "Vendedor de helados"] },
    { lugar: "Universidad", roles: ["Profesor", "Alumno", "Decano", "Secretaria", "Bibliotecario", "Estudiante de intercambio"] },
    { lugar: "Farmacia", roles: ["Farmacéutica", "Cliente", "Cajero", "Repartidor", "Visitador médico", "Señora con receta"] },
    { lugar: "Estación de servicio", roles: ["Playero", "Cliente", "Cajero", "Mecánico", "Camionero", "Repartidor en moto"] },
    { lugar: "Oficina", roles: ["Jefe", "Secretaria", "Pasante", "Contador", "Recursos humanos", "Técnico de sistemas", "Empleado del mes"] },
    { lugar: "Cárcel", roles: ["Guardia", "Preso", "Director", "Visita", "Abogado", "Cocinero"] },
    { lugar: "Parque de diversiones", roles: ["Operador de la montaña rusa", "Nene", "Papá", "Vendedor de algodón", "Guardia", "Pareja"] },
    { lugar: "Carnaval", roles: ["Comparsera", "Músico", "Espectador", "Jurado", "Vendedor de nieve", "Bailarín", "Policía"] },
    { lugar: "Museo", roles: ["Guía", "Turista", "Guardia", "Restauradora", "Estudiante", "Artista"] },
    { lugar: "Fiesta de San Juan", roles: ["Comisión de la fiesta", "Vendedora de chipa", "Nene jugando a la pelota tata", "Cura", "Músico", "Kamba ra'anga"] },
  ];

  raiz.LUGARES = LUGARES;
  if (typeof module !== "undefined" && module.exports) module.exports = { LUGARES };
})(typeof window !== "undefined" ? window : globalThis);
