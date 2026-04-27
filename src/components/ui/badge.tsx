import { component$ } from "@builder.io/qwik";

interface BadgeProps {
  variant?: "success" | "danger" | "warning" | "info" | "neutral";
  children: any;
}

export const Badge = component$<BadgeProps>(({ variant = "neutral" }) => {
  const classMap: Record<string, string> = {
    success: "badge badge-success",
    danger: "badge badge-danger",
    warning: "badge badge-warning",
    info: "badge badge-info",
    neutral: "badge badge-neutral",
  };

  return (
    <span class={classMap[variant]}>
      <slot />
    </span>
  );
});

/** Status badge for active/inactive */
export const StatusBadge = component$<{ active: boolean }>(({ active }) => (
  <span class={active ? "badge badge-success" : "badge badge-danger"}>
    <span
      style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "currentColor",
      }}
    />
    {active ? "Ativo" : "Inativo"}
  </span>
));

/** Care modality badge */
export const ModalityBadge = component$<{ modality: string }>(({ modality }) => (
  <span class={modality === "AD" ? "badge badge-info" : "badge badge-warning"}>
    {modality}
  </span>
));

/** Event category labels in Portuguese */
const CATEGORY_LABELS: Record<string, string> = {
  alta_domiciliar: "Alta Domiciliar",
  intercorrencia: "Intercorrência",
  internacao_hospitalar: "Internação Hospitalar",
  obito: "Óbito",
  alteracao_pad: "Alteração PAD",
  quantitativo_paciente: "Quantitativo",
  paciente_infectado: "Paciente Infectado",
  evento_adverso: "Evento Adverso",
  ouvidoria: "Ouvidoria",
};

const CATEGORY_VARIANTS: Record<string, string> = {
  alta_domiciliar: "badge badge-success",
  intercorrencia: "badge badge-warning",
  internacao_hospitalar: "badge badge-danger",
  obito: "badge badge-danger",
  alteracao_pad: "badge badge-info",
  quantitativo_paciente: "badge badge-neutral",
  paciente_infectado: "badge badge-danger",
  evento_adverso: "badge badge-warning",
  ouvidoria: "badge badge-info",
};

export const CategoryBadge = component$<{ category: string }>(({ category }) => (
  <span class={CATEGORY_VARIANTS[category] || "badge badge-neutral"}>
    {CATEGORY_LABELS[category] || category}
  </span>
));

/** Sub-category labels in Portuguese */
const SUB_CATEGORY_LABELS: Record<string, string> = {
  resolvida_domicilio: "Resolvida em domicílio",
  remocao_aph: "Remoção APH",
  deterioracao_clinica: "Deterioração clínica",
  nao_aderencia_tratamento: "Não aderência",
  obito_menos_48h: "< 48h",
  obito_mais_48h: "> 48h",
  queda: "Queda",
  broncoaspiracao: "Broncoaspiração",
  lesao_pressao: "Lesão pressão",
  decanulacao: "Decanulação",
  saida_acidental_gtt: "Saída GTT",
  elogio: "Elogio",
  sugestao: "Sugestão",
  reclamacao_solicitacao: "Reclamação/Solicitação",
};

export const SubCategoryBadge = component$<{ subCategory: string | null }>(
  ({ subCategory }) => {
    if (!subCategory) return null;
    return (
      <span class="badge badge-neutral">
        {SUB_CATEGORY_LABELS[subCategory] || subCategory}
      </span>
    );
  }
);
