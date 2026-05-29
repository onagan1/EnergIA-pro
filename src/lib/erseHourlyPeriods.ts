// Períodos horários BTN em Portugal Continental
// Fonte: ERSE - "Períodos Horários na Energia Elétrica em Portugal" (setembro 2020)
// https://www.erse.pt/media/wijn0vgt/periodos-horários-de-energia-elétrica-em-portugal.pdf

export type PeriodKind = "ponta" | "cheia" | "vazio" | "fora_vazio";

export interface PeriodSlot {
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
  kind: PeriodKind;
}

export interface DaySchedule {
  label: string;          // ex: "Hora legal de Inverno"
  slots: PeriodSlot[];
}

export interface CycleSection {
  title: string;          // ex: "Dias úteis"
  schedules: DaySchedule[];
}

export interface HourlyPeriodSet {
  title: string;
  sections: CycleSection[];
}

// ---------- CICLO DIÁRIO – Portugal Continental ----------
const DIARIO_TRI: HourlyPeriodSet = {
  title: "Ciclo Diário – Tri-horária",
  sections: [
    {
      title: "Todos os dias",
      schedules: [
        {
          label: "Hora legal de Inverno",
          slots: [
            { from: "00:00", to: "08:00", kind: "vazio" },
            { from: "08:00", to: "08:30", kind: "cheia" },
            { from: "08:30", to: "12:00", kind: "ponta" },
            { from: "12:00", to: "18:00", kind: "cheia" },
            { from: "18:00", to: "20:30", kind: "ponta" },
            { from: "20:30", to: "22:00", kind: "cheia" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
        {
          label: "Hora legal de Verão",
          slots: [
            { from: "00:00", to: "08:00", kind: "vazio" },
            { from: "08:00", to: "10:30", kind: "cheia" },
            { from: "10:30", to: "13:00", kind: "ponta" },
            { from: "13:00", to: "19:30", kind: "cheia" },
            { from: "19:30", to: "21:00", kind: "ponta" },
            { from: "21:00", to: "22:00", kind: "cheia" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
      ],
    },
  ],
};

const DIARIO_BI: HourlyPeriodSet = {
  title: "Ciclo Diário – Bi-horária",
  sections: [
    {
      title: "Todos os dias",
      schedules: [
        {
          label: "Hora legal de Inverno/Verão",
          slots: [
            { from: "00:00", to: "08:00", kind: "vazio" },
            { from: "08:00", to: "22:00", kind: "fora_vazio" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
      ],
    },
  ],
};

// ---------- CICLO SEMANAL – Portugal Continental ----------
const SEMANAL_TRI: HourlyPeriodSet = {
  title: "Ciclo Semanal – Tri-horária",
  sections: [
    {
      title: "Dias úteis",
      schedules: [
        {
          label: "Hora legal de Inverno",
          slots: [
            { from: "00:00", to: "07:00", kind: "vazio" },
            { from: "07:00", to: "09:30", kind: "cheia" },
            { from: "09:30", to: "12:00", kind: "ponta" },
            { from: "12:00", to: "18:30", kind: "cheia" },
            { from: "18:30", to: "21:00", kind: "ponta" },
            { from: "21:00", to: "24:00", kind: "vazio" },
          ],
        },
        {
          label: "Hora legal de Verão",
          slots: [
            { from: "00:00", to: "07:00", kind: "vazio" },
            { from: "07:00", to: "09:15", kind: "cheia" },
            { from: "09:15", to: "12:15", kind: "ponta" },
            { from: "12:15", to: "24:00", kind: "cheia" },
          ],
        },
      ],
    },
    {
      title: "Sábado",
      schedules: [
        {
          label: "Hora legal de Inverno",
          slots: [
            { from: "00:00", to: "09:30", kind: "vazio" },
            { from: "09:30", to: "13:00", kind: "cheia" },
            { from: "13:00", to: "18:30", kind: "vazio" },
            { from: "18:30", to: "22:00", kind: "cheia" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
        {
          label: "Hora legal de Verão",
          slots: [
            { from: "00:00", to: "09:00", kind: "vazio" },
            { from: "09:00", to: "14:00", kind: "cheia" },
            { from: "14:00", to: "20:00", kind: "vazio" },
            { from: "20:00", to: "22:00", kind: "cheia" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
      ],
    },
    {
      title: "Domingo",
      schedules: [
        {
          label: "Hora legal de Verão/Inverno",
          slots: [{ from: "00:00", to: "24:00", kind: "vazio" }],
        },
      ],
    },
  ],
};

const SEMANAL_BI: HourlyPeriodSet = {
  title: "Ciclo Semanal – Bi-horária",
  sections: [
    {
      title: "Dias úteis",
      schedules: [
        {
          label: "Hora legal de Verão/Inverno",
          slots: [
            { from: "00:00", to: "07:00", kind: "vazio" },
            { from: "07:00", to: "24:00", kind: "fora_vazio" },
          ],
        },
      ],
    },
    {
      title: "Sábado",
      schedules: [
        {
          label: "Hora legal de Inverno",
          slots: [
            { from: "00:00", to: "09:30", kind: "vazio" },
            { from: "09:30", to: "13:00", kind: "fora_vazio" },
            { from: "13:00", to: "18:30", kind: "vazio" },
            { from: "18:30", to: "22:00", kind: "fora_vazio" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
        {
          label: "Hora legal de Verão",
          slots: [
            { from: "00:00", to: "09:00", kind: "vazio" },
            { from: "09:00", to: "14:00", kind: "fora_vazio" },
            { from: "14:00", to: "20:00", kind: "vazio" },
            { from: "20:00", to: "22:00", kind: "fora_vazio" },
            { from: "22:00", to: "24:00", kind: "vazio" },
          ],
        },
      ],
    },
    {
      title: "Domingo",
      schedules: [
        {
          label: "Hora legal de Verão/Inverno",
          slots: [{ from: "00:00", to: "24:00", kind: "vazio" }],
        },
      ],
    },
  ],
};

export type ErseTariff = "bi_horaria" | "tri_horaria";
export type ErseCycle = "diario" | "semanal";

export const getHourlyPeriods = (
  tariff: ErseTariff,
  cycle: ErseCycle
): HourlyPeriodSet | null => {
  if (cycle === "diario") return tariff === "tri_horaria" ? DIARIO_TRI : DIARIO_BI;
  if (cycle === "semanal") return tariff === "tri_horaria" ? SEMANAL_TRI : SEMANAL_BI;
  return null;
};

export const PERIOD_LABEL: Record<PeriodKind, string> = {
  ponta: "Ponta",
  cheia: "Cheia",
  vazio: "Vazio",
  fora_vazio: "Fora de Vazio",
};
