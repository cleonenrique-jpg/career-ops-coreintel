# Reporte — Rediseño editorial Coreintel · Career Ops

**Fecha:** 2026-05-24
**Estado:** Mockups en local, pendiente de aprobación para reemplazar producción
**Autor:** Carlos León / generado con Claude Code

---

## 1. Contexto

La app `career-ops` (Web Next.js + API Hono + Workers Playwright) llegó al cierre del multi-tenant en producción con la UI funcional pero genérica de Tailwind. Se solicitó un upgrade visual aplicando:

1. **Identidad de marca Coreintelhub** (paleta core/intel + acentos naranja/lima/cyan/amarillo, tipografía Montserrat, logos oficiales).
2. **Estilo editorial tipo Apple** (mucho aire, jerarquía tipográfica fuerte, badges sutiles, monocromático con acentos como datos).
3. **Franja de marca multicolor de 4px** arriba de todo (firma visual del preset 2 "Editorial Clean" del skill `coreintel-brand`).

El requisito explícito fue armar **mockups paralelos en `/preview`** antes de tocar las páginas productivas, para revisar sin riesgo.

---

## 2. Páginas mocupeadas

Todas conservan **la lógica original 1:1** (mismas llamadas al API, mismas validaciones, mismo data flow). Solo cambia JSX/classNames.

| Producción | Preview | Tamaño orig. → preview | Estado |
|---|---|---|---|
| `/admin/page.tsx` | `/admin/preview/page.tsx` | 220 → ~290 líneas | ✅ Listo |
| `/sistema/page.tsx` | `/sistema/preview/page.tsx` | 196 → ~265 líneas | ✅ Listo |
| `/profile/page.tsx` | `/profile/preview/page.tsx` | 310 → ~340 líneas | ✅ Listo |
| `/page.tsx` (Pipeline) | `/preview/page.tsx` | 460 → ~460 líneas | ✅ Listo |

**Componente compartido nuevo:** `apps/web/src/components/BrandBar.tsx` — encapsula la franja de marca para evitar duplicación.

---

## 3. Principios de diseño aplicados

### 3.1. Franja de marca (firma visual no negociable)

Gradiente lineal a 90°, altura 4px, edge-to-edge, posición absoluta en el top de la página antes de cualquier nav.

```
cyan (#0cc1d1) → core (#41aafd) → intel (#4b457b) → naranja (#ff910e) → amarillo (#ffc00d) → lima (#b4d70e)
0%               22%               42%                64%                 82%                  100%
```

Replica el swirl multicolor del logo Coreintel. Es la única instancia donde los acentos de marca aparecen sin escala accesible — porque no portan texto.

### 3.2. Jerarquía tipográfica editorial

| Elemento | Spec |
|---|---|
| **Eyebrow** (kicker) | `text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium` |
| **H1 (página)** | `text-5xl md:text-6xl font-bold text-intel-700 tracking-[-0.02em] leading-[1.05]` |
| **Subtítulo** | `text-base text-gris-500 leading-relaxed max-w-xl` |
| **Section label** | `text-[11px] uppercase tracking-[0.18em] text-gris-500 font-medium` |
| **Table th** | `text-[10px] uppercase tracking-[0.15em] text-gris-500 font-medium` |
| **Stat number** | `text-3xl font-bold text-intel-700 tabular-nums` |
| **Pill badge** | `text-[10px] uppercase tracking-[0.1em] font-semibold` |

La fuente sigue siendo Montserrat (heredada del layout). El skill `coreintel-brand` documenta que el preset editorial canónico usa SF system stack, pero acá se priorizó consistencia de marca sobre purismo del preset.

### 3.3. Paleta de superficies

| Token | Color | Uso |
|---|---|---|
| Background canvas | `#FBFBFA` | Fondo de página warm bone |
| Card surface | `#FFFFFF` | Cards principales |
| Card secundario | `#F5F5F7` | Code blocks, inputs deshabilitados |
| Border hairline | `#EAEAEA` | Bordes de cards y tablas |
| Row divider | `#F3F3F1` | Divisores internos de tabla |
| Hover row | `#FBFBFA` | Bg en hover de fila |

**No shadows pesados.** Cards solo con `border 1px solid #EAEAEA`. La profundidad viene del color de fondo y del contraste, no de sombras.

### 3.4. Badges como muted pastels

Reemplazan los pills opacos `bg-core/10 text-core-700` originales por la paleta de pastels desaturados del preset Editorial Clean. Más sutiles, más legibles, evitan saturar la pantalla cuando hay muchos.

| Estado | Background | Texto |
|---|---|---|
| Activo / Aprobado / Oferta | `#EDF3EC` | `#346538` |
| Pendiente / Reactivar / Contactada | `#FBF3DB` | `#7a5d00` |
| Suspendido / Rechazada | `#FDEBEC` | `#9F2F2D` |
| Aplicada / Invitar | `#E1F3FE` | `#1F6C9F` |
| Entrevista | `#FDE9D7` | `#a85100` |
| Neutral / Skip / Descartada | `#F3F3F1` | `gris-500` |

### 3.5. Botones

| Tipo | Estilo |
|---|---|
| **Primario** (CTA único por sección) | `bg-intel-700 text-white rounded-md px-5 py-2 active:scale-[0.98]` |
| **Secundario** (acciones contextuales) | `border-[#EAEAEA] text-intel-700` que tinta al hover según semántica |
| **Ghost link** (navegación inline) | `text-intel-700 hover:underline` |

Eliminado el botón coral primario por completo. El primario único de la app es ahora `intel-700` (deep blue de marca).

### 3.6. Inputs

Reemplazo de full-border inputs (`border rounded`) por **underline-only** estilo Apple:

```tsx
className="border-0 border-b border-[#EAEAEA] bg-transparent px-0 py-2
           focus:outline-none focus:border-intel-700 transition-colors"
```

Excepción: inputs cortos (search, select de moneda, dropdown de rol) que mantienen border completo para señalizar "elegir entre opciones discretas".

### 3.7. Tablas

- Header row con `border-b border-[#EAEAEA]`, no bg de color
- Cells con `px-6 py-4` o `py-5` (vs `px-3 py-2` original) — **2.5x más respiración vertical**
- Fechas/IDs/scores en `font-mono`
- Hover row sutil (`bg-[#FBFBFA]`)
- Status como pill en lugar de columna iconográfica
- Action buttons como outline pills compactos en la derecha

---

## 4. Cambios específicos por página

### 4.1. `/admin/preview`

- **Nuevo:** Stat strip de 4 KPIs (Total, Activos, Pendientes, Admins) en grid de hairlines
- **Invite form:** Input email underline-only, select de rol en dropdown chico, CTA `intel-700`
- **Tabla de usuarios:** Cada user con email + fullName en sub-texto, pill de status, botones outline (Aprobar verde, Suspender rojo, Hacer admin neutro)
- **Audit log:** Mantiene la tabla agregada en el feature anterior, pero con misma estética editorial (timestamps en font-mono, badges como pills)
- **Self-action guard:** Etiqueta sutil "Vos" en uppercase tracking-wide en lugar de "(vos)" entre paréntesis

### 4.2. `/sistema/preview`

- **Tabs editorial:** bottom-border highlight 2px en intel-700, sin pills coloridas
- **Tab Fuentes:** Grid de 2 KPIs (Total portales + Breakdown por fuente con monospace) + tabla refinada de portales
- **Tab Scans:** Single card con label "Fuentes activas" como kicker y lista inline tipográfica
- **Tab Costos:** Stat de costo acumulado en `text-5xl tracking-tight` + card del modelo activo con código en bg `#F5F5F7`
- **Tab Storage:** Cards con `<code>` blocks consistentes

### 4.3. `/profile/preview`

- **Tabs:** mismo patrón editorial
- **Tab Info:** Grid de 8 fields underline-only en 2 columnas, narrativa como `<textarea>` con border ligero, todo dentro de un solo card grande con `p-10`
- **Tab CV:** Editor + preview side-by-side con labels "Editor" / "Preview" en kickers, scroll interno
- **Tab Archetypes:** Cada archetype como grid de 4 columnas (nombre underline, level border, fit como pill-dropdown, quitar como link), separadas por hairlines internas
- **Tab Comp:** 3 NumFields underline en font-mono
- **Tab Idiomas:** Select underline grande

### 4.4. `/preview` (Pipeline — la más compleja)

- **KPI strip clickeable:** 5 stats (Pendientes, Aplicadas, Entrevistas, Ofertas, Cerradas). Cada uno actúa como filtro toggle (background `intel-700` cuando activo).
- **Follow-ups alert:** Mantenido como sección destacada en `bg-[#FBF3DB]` (pastel amarillo) en lugar del Card con borde verde original.
- **Agregar URL:** Card dedicada con input underline + CTA primario + outline "Scan ahora".
- **Filter chips:** "Todas" y "Score ≥ 4.0" como pills rounded-full con border hairline, ml-auto search compacto.
- **Tabla principal:** Score destacado en `text-2xl font-bold tabular-nums tracking-tight` con color semántico (verde/naranja/rojo), status pills muted pastels, CV adapt como pill `#E1F3FE` con porcentaje en monospace.
- **Expand row:** Línea de tiempo + notas en 2 columnas con kickers, links como ghost (sin íconos), RowMenu en la esquina.
- **Empty state:** Mensaje simple centrado sin íconos.

---

## 5. Comparativa de "feel"

| Aspecto | Original | Mockup editorial |
|---|---|---|
| **Densidad** | Alta (rows py-2, gaps de 8-12px) | Media (rows py-5, gaps de 24-48px) |
| **Color** | Marca presente como CTA y badges | Marca presente como acento, pastels para badges |
| **Tipografía** | Jerarquía media (h1 → h3 → body) | Jerarquía extrema (h1 5xl/6xl → kicker 10px) |
| **Sombras** | `shadow-sm` en cards | Sin sombras, solo border 1px |
| **Botones** | Coral primario + Intel secundario | Intel primario único + outlines semánticos |
| **Bordes** | `gris-300` (más oscuro) | `#EAEAEA` (ultra-light hairline) |
| **Fondo** | Blanco puro | Warm bone `#FBFBFA` |
| **Personalidad** | Dashboard SaaS estándar | Editorial premium tipo Apple/Linear |

---

## 6. Archivos modificados/creados

```
apps/web/src/
├── components/
│   └── BrandBar.tsx                            [NUEVO]
└── app/
    ├── preview/
    │   └── page.tsx                            [NUEVO] (pipeline)
    ├── admin/preview/
    │   └── page.tsx                            [NUEVO]
    ├── profile/preview/
    │   └── page.tsx                            [NUEVO]
    └── sistema/preview/
        └── page.tsx                            [NUEVO]
```

**Total LOC nuevas:** ~1350 líneas
**Cambios destructivos:** 0 (todas las páginas productivas intactas)

Adicionalmente:

```
~/.claude/skills/coreintel-brand/
└── SKILL.md                                    [ACTUALIZADO]
    ↳ Nueva sección "Franja de marca — firma visual"
```

---

## 7. Riesgos y consideraciones

1. **Densidad vs respiración:** El mockup priorizó respiración. En sesiones largas con muchos rows (50+ aplicaciones) puede sentirse "menos eficiente" que la versión densa actual. Mitigación: la tabla del pipeline es scrollable y los KPIs filtran rápido.

2. **Color de marca:** El primario único es ahora `intel-700` (deep blue). El `core` (azul brillante) original quedó relegado a usos de datos/contraste. Si Carlos prefiere que el coral/core aparezca como CTA en algún lugar, hay que decidir cuál.

3. **Montserrat vs SF Pro:** El preset Editorial Clean del skill canónico usa SF system. Acá se mantuvo Montserrat por consistencia con el resto del site. Si quisiéramos pureza absoluta del preset, habría que cambiar la fuente, lo cual afecta todo el bundle.

4. **Sin franja de marca en originales:** Los previews tienen la franja de marca, pero `/login`, `/onboarding`, `/applications/[id]`, `/` (pipeline original) NO. Si aprobamos, hay dos rutas:
   - **a)** Mover `<BrandBar />` al `layout.tsx` root — aparece en TODAS las páginas instantáneamente, incluyendo las que no rediseñamos.
   - **b)** Solo agregarla en las páginas que migremos a editorial — coherencia visual con el rediseño.

5. **Componentes legacy:** Hay componentes (`Card`, `Button`, `Tabs`, `Icon`, `StatusBadge`, `Ribbon`) en `apps/web/src/components/*` que los previews **no usan**. Si reemplazamos los originales, esos componentes quedan huérfanos en algunas páginas. Decidir si:
   - Refactorizar los componentes globalmente con el nuevo estilo (afecta páginas no migradas como `/applications/[id]`).
   - O migrar páginas a inline-classes como hicieron los previews (más código pero más control).

---

## 8. Próximas decisiones requeridas

| # | Decisión | Bloqueante para |
|---|---|---|
| 1 | ¿Aprobar dirección editorial? | Todo |
| 2 | ¿Franja de marca global (layout.tsx) o por página? | Touch points |
| 3 | ¿Refactor de componentes globales o inline-classes por página? | Estrategia de migración |
| 4 | ¿`/applications/[id]/page.tsx` también migra al estilo editorial? | Coherencia total |
| 5 | ¿`/login` y `/onboarding` también? | First-impression de la app |
| 6 | ¿Deploy a prod inmediato (commit + push) o staging primero? | Timing |

---

## 9. Próximos pasos sugeridos (en orden)

1. **Revisión visual** de los 4 previews en local (15 min).
2. **Feedback** específico por página (qué ajustar, qué falta, qué sobra).
3. **Aplicar cambios** del feedback a los previews hasta convergencia.
4. **Decisión arquitectural** sobre estrategia de migración (decisión #3).
5. **Migrar `/admin`, `/`, `/profile`, `/sistema`** a la versión editorial (reemplazar los `page.tsx` de prod con los `preview/page.tsx`, borrar los `preview/`).
6. **Migrar `/applications/[id]`, `/login`, `/onboarding`** a la misma estética (3 páginas adicionales).
7. **Limpiar componentes huérfanos** (`StatusBadge`, etc.) o refactor.
8. **Commit + push** → deploy a producción.
9. **Validar prod** end-to-end.

---

## 10. URLs de revisión local

| URL | Página | Notas |
|---|---|---|
| http://localhost:3000/preview | Pipeline | Login como admin requerido |
| http://localhost:3000/admin/preview | Admin | Solo admins, ya tenés acceso |
| http://localhost:3000/profile/preview | Perfil | Cualquier user logueado |
| http://localhost:3000/sistema/preview | Sistema | Cualquier user logueado |

URLs de comparación (originales en producción):

| URL prod | Página |
|---|---|
| https://web-production-11819.up.railway.app/ | Pipeline |
| https://web-production-11819.up.railway.app/admin | Admin |
| https://web-production-11819.up.railway.app/profile | Perfil |
| https://web-production-11819.up.railway.app/sistema | Sistema |
