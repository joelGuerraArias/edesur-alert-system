# Sistema de Alerta de Medios - EDESUR

Sistema de monitoreo inteligente de contenido en tiempo real para EDESUR Dominicana.

## Características

- **Monitoreo en tiempo real** de menciones en medios
- **Detección automática** de términos relevantes
- **Interfaz tipo YouTube** con tarjetas expandibles
- **Filtrado por tags** (Edesur, Apagones, Punta Catalina, etc.)
- **Reproductor de video** integrado
- **Transcripción completa** del contenido

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript
- **Base de datos**: Supabase
- **Tipografía**: Montserrat
- **Diseño**: Responsive, tema oscuro

## Instalación

1. Clona el repositorio
2. Abre `index.html` en tu navegador
3. Configura las variables de Supabase si es necesario

## Uso

- **Navegación**: Scroll natural de toda la página
- **Filtrado**: Click en los tags para filtrar contenido
- **Expansión**: Click en las tarjetas para ver detalles completos
- **Tooltip**: Hover por 3 segundos para ver contexto

## Configuración

### Supabase
- URL: `https://sfvbcprhfmwglqpyyfxz.supabase.co`
- Tabla: `alertas_medios`
- Campos: `termino_d`, `ejecutivo`, `contexto`, `transcripcion`, `url_video`

## Despliegue

El proyecto está listo para desplegar en:
- **Netlify**: Drag & drop
- **Vercel**: Importar desde GitHub
- **GitHub Pages**: Activar en configuración

## Licencia

Proyecto interno de EDESUR Dominicana, S. A.
