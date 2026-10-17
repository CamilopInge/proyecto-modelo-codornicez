# EvalCodorniz · Prototipo

Prototipo navegable del sistema de evaluación de bienestar animal en codornices de postura, basado en la metodología del ICA. Es HTML, CSS y JavaScript puros: no usa base de datos, servidor ni dependencias.

> Todo el estado vive en memoria. Al recargar la página, el sistema vuelve a los datos de ejemplo.

## Cómo abrirlo

- Abre `index.html` con doble clic en cualquier navegador moderno, o
- súbelo a GitHub Pages (Settings → Pages → rama `main`, carpeta raíz), o
- sírvelo localmente: `npx serve .` o `python -m http.server`.

## Usuarios de prueba

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `admin123` |
| Docente | `docente` | `docente123` |
| Estudiante evaluador | `evaluador` | `eval123` |
| Consultor externo | `consultor` | `consultor123` |

## Estructura

```
index.html        Punto de entrada
css/styles.css    Estilos y tokens de color (tema claro y oscuro)
js/data.js        Catálogo de los 35 indicadores (MBA, MBR, MBG) y parámetros ICA
js/app.js         Reglas de cálculo, estado en memoria, vistas y eventos
```

## Qué cubre

| Módulo | Requerimientos |
|---|---|
| Inicio de sesión, roles, bloqueo tras 5 intentos, recuperación simulada | RF01 – RF04 |
| Fincas: sistema piso/jaula, ubicación, inventario por grupo etario, baja lógica | RF05 – RF08 |
| Parametrización en modo consulta: indicadores, Tablas 1, 2 y 3, matriz de permisos | RF09 – RF12, RF38 |
| Evaluación: checklist según aves y sistema, muestreo, porcentajes, fórmula de espacio, evidencias, guardado | RF13 – RF19 |
| Cálculo, validación previa al cierre, forma oficial y críticos | RF20 – RF23 |
| Recomendaciones con IA simulada, aprobación, plan de mejora y seguimiento | RF24 – RF28 |
| Historial, panel general con filtro por departamento | RF29, RF31, RF33 |
| Usuarios y bitácora | RF03, RF39 |

### Reglas implementadas

- **Ponderación (Tabla 1):** ≥ 200 aves → MBA 60 %, MBR 25 %, MBG 15 %; < 200 aves → MBA 70 %, MBR 30 %, sin MBG.
- **Niveles (Tabla 2):** Excelente ≥ 90 · Alto ≥ 75 · Medio ≥ 50 · Bajo < 50.
- **Muestreo (Tabla 3):** < 200 aves → 1 corral y 5 puntos; ≥ 200 → 2 corrales y 9 puntos; 10 aves por punto.
- **Indicadores condicionados:** MBG solo con ≥ 200 aves; Mortalidad (MBA10) solo con > 200; MBR4 solo jaula; MBR3 y MBR14 solo piso.
- **Calificación final:** Σ (promedio del grupo × peso), redondeada a 2 decimales.

## Limitaciones del prototipo

- Sin persistencia: no hay base de datos ni almacenamiento local.
- Las recomendaciones de "IA" se generan con plantillas a partir del nivel 100 de cada ficha.
- No incluye exportación a PDF o Excel, comparación entre evaluaciones (RF30), reporte consolidado (RF36) ni notificaciones (RF40).
- El texto del nivel 50 de MBG10 (Tabla 39) está pendiente de transcribir de la norma.
# proyecto-modelo-codornicez
