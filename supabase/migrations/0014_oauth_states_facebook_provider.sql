-- Login do Facebook para Empresas é um único fluxo OAuth cobrindo Ads/Páginas/
-- Instagram/WhatsApp de uma vez (app Meta real: "Vetor-App") — precisa de um
-- valor de provider próprio em oauth_states, distinto dos providers já
-- armazenados em connections (que continuam granulares por ativo descoberto
-- após a troca de token: instagram/whatsapp/meta_ads/meta_business).
alter table oauth_states drop constraint if exists oauth_states_provider_check;
alter table oauth_states add constraint oauth_states_provider_check
  check (provider in ('instagram', 'whatsapp', 'meta_ads', 'meta_business', 'facebook'));
