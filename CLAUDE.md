# Atlas Invest — repère pour Claude Code

Avant de travailler sur une fonctionnalité produit (pas un simple fix
technique), lire `docs/SPEC.md` — c'est la spec produit consolidée V2,
document de référence qui décrit la vision cible, la doctrine financière,
les principes UX et les garde-fous du produit.

Règle de travail (section 77 de la spec) : ne jamais traiter une demande du
type « construis la V2 » comme un bloc unique. Travailler lot par lot, un
lot = un objectif précis + un périmètre + ce qui ne doit pas être modifié +
le modèle de données impacté + les règles de calcul + les cas limites + les
tests attendus + les critères d'acceptation. Faire valider un lot avant de
passer au suivant.

Garde-fous permanents à respecter dans tout le code (section 78) : ne
jamais compter un transfert deux fois, ne jamais traiter une mensualité de
crédit comme une simple consommation, ne jamais présenter une estimation
comme une donnée certaine, ne jamais cacher silencieusement un écart de
rapprochement, ne jamais produire une projection précise sans afficher ses
hypothèses.
