import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Política de Privacidade" };

/**
 * Modelo de política de privacidade para o provador virtual.
 * ⚠️ Revise com um advogado e preencha os dados da empresa (src/lib/brand.ts ou
 * variáveis NEXT_PUBLIC_*). Os provedores de IA listados devem corresponder aos
 * que você realmente usa.
 */
export default function PrivacidadePage() {
  const ttl = Number(process.env.RESULT_TTL_MINUTES) || 30;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="eyebrow">LGPD · Lei nº 13.709/2018</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Política de Privacidade do Provador Virtual</h1>
      <p className="mt-3 text-sm text-muted">Última atualização: {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ink/85 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        <section>
          <h2>1. Quem somos</h2>
          <p>
            O controlador dos dados é <strong>{BRAND.razaoSocial}</strong>, CNPJ {BRAND.cnpj} ({BRAND.nome}). Encarregado pelo tratamento de dados (DPO):{" "}
            {BRAND.encarregado} — <a className="underline" href={`mailto:${BRAND.emailPrivacidade}`}>{BRAND.emailPrivacidade}</a>.
          </p>
        </section>
        <section>
          <h2>2. Quais dados usamos</h2>
          <ul>
            <li>
              <strong>Sua foto</strong>, enviada ou tirada por você, exclusivamente para gerar a prova virtual.
            </li>
            <li>
              <strong>Pontos do corpo e silhueta</strong> calculados a partir da foto <em>no seu próprio aparelho</em>, usados para estimar proporções
              (altura, ombros, peito, cintura e quadril) e montar o avatar 3D. Essas medidas não são enviadas nem guardadas por nós.
            </li>
            <li>
              <strong>Altura</strong>, se você informar (opcional), também usada somente no seu aparelho.
            </li>
            <li>
              <strong>Métricas anônimas</strong>: contamos quantas vezes cada camisa foi provada, sem qualquer dado que identifique você.
            </li>
            <li>
              <strong>Endereço IP</strong>, de forma transitória e cifrada (hash), apenas para limitar abusos (rate limit).
            </li>
          </ul>
          <p className="mt-2">
            Não usamos a foto para reconhecimento facial, identificação, publicidade, treinamento de modelos ou qualquer outra finalidade.
          </p>
        </section>
        <section>
          <h2>3. Base legal</h2>
          <p>
            Tratamos sua imagem com base no seu <strong>consentimento</strong> (art. 7º, I, e, por cautela, art. 11, I, da LGPD), dado de forma livre,
            informada e destacada antes do envio. Você pode recusar — o catálogo continua disponível — e revogar o consentimento a qualquer momento.
          </p>
        </section>
        <section>
          <h2>4. Com quem compartilhamos</h2>
          <p>
            Para gerar a prova em foto, a imagem é enviada a um <strong>operador</strong> de inteligência artificial especializado em provador virtual
            (por exemplo, FASHN AI ou fal.ai), que processa a imagem em nosso nome e não pode usá-la para outros fins. Esses serviços podem estar
            fora do Brasil; a transferência internacional ocorre com base no seu consentimento específico (art. 33, VIII) e nas garantias contratuais
            dos fornecedores. Consulte também as políticas de retenção de cada fornecedor.
          </p>
        </section>
        <section>
          <h2>5. Por quanto tempo guardamos</h2>
          <ul>
            <li>Por padrão, <strong>não armazenamos sua foto</strong>: ela é processada em memória e descartada após a resposta.</li>
            <li>
              No modo loja (tablet/TV), a imagem final pode ficar disponível por um link temporário (QR code) por até {ttl} minutos — e nunca mais
              que 24 horas —, sendo apagada automaticamente. Você também pode apagá-la na hora pelo próprio link.
            </li>
            <li>No tablet da loja, os dados do cliente anterior são apagados automaticamente após 60 segundos sem uso.</li>
          </ul>
        </section>
        <section>
          <h2>6. Seus direitos</h2>
          <p>
            Você pode solicitar confirmação, acesso, correção, eliminação, informação sobre compartilhamento e revogação do consentimento (art. 18 da
            LGPD) pelo e-mail <a className="underline" href={`mailto:${BRAND.emailPrivacidade}`}>{BRAND.emailPrivacidade}</a>. Você também pode
            reclamar à ANPD.
          </p>
        </section>
        <section>
          <h2>7. Segurança</h2>
          <p>
            Usamos conexão criptografada (HTTPS), validação de arquivos, remoção de metadados das imagens (como localização GPS), limites de uso e
            links temporários com códigos aleatórios.
          </p>
        </section>
        <section>
          <h2>8. Sobre o resultado</h2>
          <p>
            A prova em foto é gerada por IA e pode conter diferenças em relação à peça real. A visualização 360° utiliza um avatar 3D com proporções
            aproximadas, estimadas a partir de uma única foto — não é uma reconstrução exata do seu corpo.
          </p>
        </section>
      </div>
    </article>
  );
}
