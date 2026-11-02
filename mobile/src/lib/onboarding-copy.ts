import type { OnboardingErrorCode, PermissionKind, PermissionStatus } from '@/domain/onboarding';

const ERRORS: Record<OnboardingErrorCode, string> = {
  invalid_phone: 'Use o formato com DDI, por exemplo +55 11 99999-0000.',
  invalid_username: 'Use 3 a 32 caracteres: letras minúsculas, números, ponto ou traço.',
  username_taken: 'Esse nome já está em uso. Tente outro.',
  phone_taken: 'Este número já tem uma conta. Entrando nela.',
  bridge_unreachable: 'Não deu para falar com o servidor. Tente de novo.',
  login_failed: 'A conta foi criada, mas o login falhou. Tente de novo.',
};

export const errorMessage = (code: OnboardingErrorCode) => ERRORS[code];

export const PERMISSION_COPY: Record<PermissionKind, { title: string; reason: string }> = {
  nearby: { title: 'Bluetooth', reason: 'Para achar quem está perto e conversar sem internet.' },
  notifications: { title: 'Notificações', reason: 'Para avisar quando chegar mensagem ou chamada.' },
  microphone: { title: 'Microfone', reason: 'Para chamadas e mensagens de voz.' },
  contacts: { title: 'Contatos', reason: 'Para mostrar quais contatos já usam o app.' },
};

const STATUS: Record<PermissionStatus, string> = {
  granted: 'Permitido',
  denied: 'Não permitido',
  blocked: 'Bloqueado nos Ajustes',
  undetermined: '',
};

export function statusLabel(status: PermissionStatus, platform: string, kind: PermissionKind) {
  if (status === 'undetermined' && platform === 'ios' && kind === 'nearby') {
    return 'O iPhone pergunta na primeira conexão';
  }
  return STATUS[status];
}
