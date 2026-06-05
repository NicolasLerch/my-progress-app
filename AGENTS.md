My progress - Progress track v1

Aplicación mobile-first para rastrear el progreso en el gimnasio y tener registro de los pesos y ejercicios utilizados.

Alcance:
Plan del gimnasio:
el usuario puede:
- Agregar, ver, modificar, eliminar planes
- Agregar ver modificar quitar los pesos que use cada dia en cada ejercicio del plan
- cada usuario tiene un crud solo de sus planes. no puede ver planes ni progreso de otros usuarios.
- Historial de los días y ejercicios realizados
- Ver una tabla/grafico de líneas del progreso de cada ejercicio según los días y los pesos usados que fueron registrados, junto con otras estadísticas.


relaciones:
cada usuario puede tener uno o mas planes
cada plan pertenece a un usuario


Pantalla principal (Home):
muestra los ejercicios del dia de hoy. por ejemplo (Hoy toca dia 1 - pecho) y muestra el plan.

Pantalla "comenzar".
Cuando el usuario comienza el ejercicio del dia, se abre la sesión del dia correspondiente y puede ir agregando uno a uno los pesos, repeticiones, series y notas en cada ejercicio. se deben ir guardando de a uno (en memoria local y luego subirlo a la ddbb? o ir subiendo directamente a la ddbb a medida que vaya completando el dia?). asi puede ver cual es la planificación y compararlo con su desempeño en el momento.

Pantalla de progreso:
El usuario puede elegir un ejercicio, y se mostrara un grafico de linea con la fecha en el eje de las x y los pesos en el eje de la y. También debajo del grafico mostrara cual es el mayor peso logrado y en que fecha, y cual el menor peso y fecha, para saber el avance neto y el tiempo que tomo. también que muestre el máximo volumen (reps * peso * series).

Pantalla historial:
Permite visualizar una tabla con el dia del plan y los pesos para saber exactamente que hizo el usuario.



Entidades:
User
- id
- email
- name
- createdAt

Plan
- id
- userId
- name
- startDate
- endDate
- createdAt
- updatedAt

PlanDay
- id
- planId
- name
- order

PlanExercise
- id
- planDayId
- exerciseId
- targetSets
- targetReps
- restSeconds
- notes

Exercise
- id
- name
- muscleGroup

Cuando el usuario comienza el ejercicio, comienza un sesión WorkoutSession, asi queda registro de cada sesión sin modificar el plan:

WorkoutSession
- id
- userId
- planId
- date
- notes

WorkoutExercise
- id
- workoutSessionId
- exerciseId

WorkoutSet
- id
- workoutExerciseId
- setNumber
- weight
- reps
- rir
- notes



MVP:
la aplicación permite realizar el seguimiento del peso de los ejercicios y planes.
Es un PWA. la base del frontend ya esta hecha con React. El backend lo haremos con node y PostgreSQL en supabase.
Dejemos la gestion de usuario para supabase


FUERA DE ALCANCE
v2:
control y seguimiento de peso corporal
notificaciones y recordatorios de suplementos
objetivos! x cantidad de peso o de volumen en determinado ejercicio

v3:
usuarios profesores y "alumnos"
posibilidad de compartir el progreso?
