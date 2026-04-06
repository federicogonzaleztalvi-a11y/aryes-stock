// PrivacyPage.jsx — Política de Privacidad
import { useEffect } from 'react';

const F = "'Inter','SF Pro Display',-apple-system,sans-serif";
const G = '#1a8a3c';

export default function PrivacyPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const S = {
    page: { minHeight: '100vh', background: '#f9f9f7', padding: '60px 24px 80px' },
    container: { maxWidth: 720, margin: '0 auto' },
    back: { display: 'inline-block', fontFamily: F, fontSize: 13, color: G, textDecoration: 'none', fontWeight: 600, marginBottom: 32 },
    h1: { fontFamily: F, fontSize: 28, fontWeight: 700, color: '#1a1a18', margin: '0 0 8px' },
    updated: { fontFamily: F, fontSize: 13, color: '#9a9a98', margin: '0 0 40px' },
    h2: { fontFamily: F, fontSize: 18, fontWeight: 700, color: '#1a1a18', margin: '40px 0 12px' },
    p: { fontFamily: F, fontSize: 14, color: '#4a4a48', lineHeight: 1.7, margin: '0 0 16px' },
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <a href="/" style={S.back}>← Volver</a>
        <h1 style={S.h1}>Política de Privacidad</h1>
        <p style={S.updated}>Última actualización: abril 2026</p>

        <h2 style={S.h2}>1. Información que recopilamos</h2>
        <p style={S.p}>Recopilamos la información que nos proporcionás al registrarte y usar el Servicio: nombre, email, nombre de tu empresa, teléfono de contacto. También recopilamos datos de uso como frecuencia de acceso, funciones utilizadas y rendimiento del sistema. No recopilamos información financiera personal — los pagos son procesados directamente por MercadoPago.</p>

        <h2 style={S.h2}>2. Datos de tu negocio</h2>
        <p style={S.p}>Los datos comerciales que cargás en la plataforma (productos, clientes, ventas, facturas, rutas, stock) son de tu propiedad exclusiva. Los almacenamos de forma segura para prestarte el Servicio. No vendemos, compartimos ni usamos tus datos comerciales para ningún otro fin que no sea la prestación del Servicio.</p>

        <h2 style={S.h2}>3. Cómo usamos tu información</h2>
        <p style={S.p}>Usamos tu información para: (a) proveer y mantener el Servicio; (b) enviarte notificaciones relevantes sobre tu cuenta (vencimiento de trial, actualizaciones, alertas operativas); (c) brindarte soporte técnico; (d) mejorar el Servicio basándonos en patrones de uso agregados y anonimizados. No enviamos comunicaciones de marketing sin tu consentimiento.</p>

        <h2 style={S.h2}>4. Almacenamiento y seguridad</h2>
        <p style={S.p}>Tus datos se almacenan en servidores de Supabase (infraestructura de Amazon Web Services) con encriptación en reposo y en tránsito (TLS 1.2+). Implementamos Row Level Security (RLS) a nivel de base de datos para garantizar que ningún usuario pueda acceder a datos de otra organización. Realizamos backups automáticos diarios con retención de punto en el tiempo.</p>

        <h2 style={S.h2}>5. Aislamiento de datos</h2>
        <p style={S.p}>Cada organización tiene un identificador único (org_id). Todas las consultas a la base de datos están filtradas automáticamente por este identificador a nivel de infraestructura. Es técnicamente imposible que un usuario acceda a datos de otra organización a través de la aplicación.</p>

        <h2 style={S.h2}>6. Acceso a tus datos</h2>
        <p style={S.p}>Solo vos y los usuarios que invites a tu organización tienen acceso a tus datos. Nuestro equipo técnico puede acceder a tus datos únicamente con tu consentimiento explícito para resolver un problema de soporte, o cuando la ley lo requiera. Todo acceso queda registrado en logs de auditoría.</p>

        <h2 style={S.h2}>7. Compartir información con terceros</h2>
        <p style={S.p}>No vendemos ni compartimos tu información personal ni tus datos comerciales con terceros, excepto: (a) procesadores de pago (MercadoPago) para gestionar tu suscripción; (b) proveedores de infraestructura (Supabase, Vercel) que procesan datos bajo nuestras instrucciones y acuerdos de confidencialidad; (c) cuando sea requerido por ley o autoridad competente.</p>

        <h2 style={S.h2}>8. Portal B2B y datos de tus clientes</h2>
        <p style={S.p}>Si activás el portal B2B, tus clientes pueden acceder al catálogo y realizar pedidos usando autenticación OTP (código por WhatsApp/SMS). Los datos de tus clientes (teléfono, historial de pedidos) están protegidos bajo las mismas políticas de seguridad y aislamiento. Sos responsable de informar a tus clientes sobre el uso de sus datos a través de tu plataforma.</p>

        <h2 style={S.h2}>9. Cookies y tecnologías de seguimiento</h2>
        <p style={S.p}>Usamos almacenamiento local del navegador (localStorage) para mantener tu sesión activa y tus preferencias de configuración. No usamos cookies de terceros, no usamos herramientas de tracking publicitario, y no compartimos datos de navegación con redes de anuncios.</p>

        <h2 style={S.h2}>10. Retención de datos</h2>
        <p style={S.p}>Tus datos se conservan mientras tu cuenta esté activa. Al cancelar tu cuenta, conservamos tus datos por 30 días para permitirte reactivar o exportar. Después de ese período, todos tus datos se eliminan permanentemente de nuestros servidores y backups en un plazo de 90 días.</p>

        <h2 style={S.h2}>11. Tus derechos</h2>
        <p style={S.p}>Tenés derecho a: (a) acceder a todos tus datos en cualquier momento desde la plataforma; (b) solicitar la corrección de datos incorrectos; (c) solicitar la eliminación de tu cuenta y datos; (d) exportar tus datos; (e) revocar tu consentimiento para comunicaciones. Para ejercer estos derechos, escribinos a contacto@aryes.com.uy</p>

        <h2 style={S.h2}>12. Menores de edad</h2>
        <p style={S.p}>El Servicio está diseñado para uso empresarial y no está dirigido a menores de 18 años. No recopilamos intencionalmente información de menores de edad.</p>

        <h2 style={S.h2}>13. Cambios a esta política</h2>
        <p style={S.p}>Podemos actualizar esta política de privacidad periódicamente. Los cambios se notificarán por email y/o dentro de la plataforma con al menos 15 días de anticipación. La fecha de última actualización siempre será visible al inicio de esta página.</p>

        <h2 style={S.h2}>14. Contacto</h2>
        <p style={S.p}>Para consultas sobre privacidad, escribinos a contacto@aryes.com</p>

        <div style={{ borderTop: '1px solid #e2e2de', marginTop: 48, paddingTop: 24 }}>
          <p style={{ fontFamily: F, fontSize: 12, color: '#9a9a98' }}>© 2026 Aryes. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
