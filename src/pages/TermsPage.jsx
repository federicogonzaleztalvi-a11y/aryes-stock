// TermsPage.jsx — Términos de Servicio
import { useEffect } from 'react';

const F = "'Inter','SF Pro Display',-apple-system,sans-serif";
const G = '#059669';

export default function TermsPage() {
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
        <h1 style={S.h1}>Términos de Servicio</h1>
        <p style={S.updated}>Última actualización: abril 2026</p>

        <h2 style={S.h2}>1. Aceptación de los términos</h2>
        <p style={S.p}>Al registrarte, acceder o utilizar Pazque (en adelante, "el Servicio"), aceptás estos Términos de Servicio. Si no estás de acuerdo, no utilices el Servicio. Pazque es operado por Pazque S.R.L. (en adelante, "nosotros").</p>

        <h2 style={S.h2}>2. Descripción del servicio</h2>
        <p style={S.p}>Pazque es una plataforma SaaS de gestión comercial para distribuidoras B2B. Incluye módulos de inventario, ventas, rutas, facturación, portal B2B para clientes, seguimiento de entregas y reportes. El Servicio se provee "tal cual" y está sujeto a mejoras continuas.</p>

        <h2 style={S.h2}>3. Registro y cuenta</h2>
        <p style={S.p}>Para usar el Servicio debés crear una cuenta con información veraz. Sos responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades que ocurran bajo tu cuenta. Debés notificarnos inmediatamente de cualquier uso no autorizado.</p>

        <h2 style={S.h2}>4. Período de prueba y suscripción</h2>
        <p style={S.p}>El Servicio ofrece un período de prueba gratuito de 14 días. Al finalizar el período de prueba, se requiere una suscripción paga para continuar usando el Servicio. Los precios están publicados en nuestra página web y pueden ser modificados con un aviso previo de 30 días. La suscripción se renueva automáticamente cada mes salvo que la canceles.</p>

        <h2 style={S.h2}>5. Pagos y facturación</h2>
        <p style={S.p}>Los pagos se procesan a través de MercadoPago u otros procesadores de pago autorizados. Al suscribirte, autorizás el cobro recurrente mensual. En caso de falta de pago, nos reservamos el derecho de suspender el acceso al Servicio después de un período de gracia de 3 días. No se realizan reembolsos por períodos parciales de uso.</p>

        <h2 style={S.h2}>6. Tus datos</h2>
        <p style={S.p}>Vos sos el dueño de todos los datos que cargues en el Servicio (productos, clientes, ventas, facturas, etc.). Nosotros no accedemos a tus datos salvo cuando sea necesario para brindarte soporte técnico o por requerimiento legal. Podés exportar tus datos en cualquier momento. Al cancelar tu cuenta, tus datos se conservan por 30 días y luego se eliminan permanentemente.</p>

        <h2 style={S.h2}>7. Uso aceptable</h2>
        <p style={S.p}>Te comprometés a usar el Servicio únicamente para fines lícitos y de acuerdo con estos términos. No podés: (a) intentar acceder a datos de otras organizaciones; (b) usar el Servicio para actividades ilegales; (c) intentar vulnerar la seguridad del sistema; (d) revender o redistribuir el acceso al Servicio sin autorización.</p>

        <h2 style={S.h2}>8. Disponibilidad del servicio</h2>
        <p style={S.p}>Nos esforzamos por mantener el Servicio disponible las 24 horas, los 7 días de la semana. Sin embargo, no garantizamos una disponibilidad del 100%. El Servicio puede tener interrupciones programadas para mantenimiento o actualizaciones, las cuales intentaremos notificar con anticipación cuando sea posible.</p>

        <h2 style={S.h2}>9. Limitación de responsabilidad</h2>
        <p style={S.p}>En la máxima medida permitida por la ley, Pazque no será responsable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso o la imposibilidad de uso del Servicio. Nuestra responsabilidad total no excederá el monto pagado por vos en los últimos 3 meses de suscripción.</p>

        <h2 style={S.h2}>10. Cancelación</h2>
        <p style={S.p}>Podés cancelar tu suscripción en cualquier momento desde la configuración de tu cuenta. La cancelación toma efecto al final del período de facturación vigente. Tras la cancelación, tendrás acceso de solo lectura a tus datos por 30 días.</p>

        <h2 style={S.h2}>11. Modificaciones</h2>
        <p style={S.p}>Nos reservamos el derecho de modificar estos términos. Los cambios se notificarán por email y/o dentro de la plataforma con al menos 15 días de anticipación. El uso continuado del Servicio después de la notificación constituye aceptación de los nuevos términos.</p>

        <h2 style={S.h2}>12. Ley aplicable</h2>
        <p style={S.p}>Estos términos se rigen por las leyes del país donde Pazque tenga su domicilio legal. Cualquier disputa será sometida a la jurisdicción de los tribunales competentes de dicho domicilio.</p>

        <h2 style={S.h2}>13. Contacto</h2>
        <p style={S.p}>Para consultas sobre estos términos, escribinos a contacto@pazque.com</p>

        <div style={{ borderTop: '1px solid #e2e2de', marginTop: 48, paddingTop: 24 }}>
          <p style={{ fontFamily: F, fontSize: 12, color: '#9a9a98' }}>© 2026 Pazque. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}
