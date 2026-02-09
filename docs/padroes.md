Vai ter todos os modulos do sistema sja maperoas com @ dentro dele havera 4 pasta e 2 arquvios as pasts page, service seram a que sempre vai ser alimnetado : dentro de pages vai ser criado a past com o nome da tela e dentro del havera mais duas pasta a form e list  
dentro da form vai haver uma pasta com o nome de tabs e dentro dela cada aba vai ter um pasta com um arquvio chamdo de index.tsx que seria o codigo da tela siga esse padrao

import { useTranslation } from 'react-i18next';

import concorrenteService from '@/@Crm/services/concorrente/concorrente-service';
import { Forms } from '@/common/components/templates/Form/Principal';
import { Form } from '@/common/components/UI/organisms/FormInputs';
import type { TabsFormProps } from '@/common/components/UI/organisms/TabsForm';
import { Concorrente } from '@/common/core/models/crm/concorrente';
import { useForm } from '@/common/hooks/form/useForm';

export const ConcorrenteTab = ({ item, ...props }: TabsFormProps) => {
const { t } = useTranslation('label');

const { register, manager } = useForm<Concorrente>({
service: concorrenteService,
model: Concorrente,
item,
});

return (
<Forms.Header {...props} manager={manager}>
<Form.Active {...register('ativo')} />

      <Form.Input label={t('nome')} {...register('nome')} />

      <Form.TextArea label={t('pontosFortes')} {...register('pontosFortes')} />

      <Form.TextArea label={t('pontosFracos')} {...register('pontosFracos')} />

      <Form.TextArea label={t('observacao')} {...register('observacoes')} />
    </Forms.Header>

);
};

e tbm dentro de form vai ter um aqruviso co o nome de index.tsx que nele precia ser mapeado acoes e todas a sbaba que foram criado esse :
import concorrenteService from '@/@Crm/services/concorrente/concorrente-service';
import { TabsForm } from '@/common/components/UI/organisms/TabsForm';

import { ConcorrenteTab } from './tabs/concorrente';

export const ConcorrenteForm = () => {
return TabsForm({
service: concorrenteService,
tabs: [{ label: 'Concorrente', Tab: ConcorrenteTab }],
});
};
siga esse padrao para criar os arquivos
ja na pasta de list vai ter a grid de lista selacao que a grid princpals : dentro de list haver aapenas umarquvio com o nome de index.tsx : sguia essa padroa : import concorrenteService from '@/@Crm/services/concorrente/concorrente-service';
import { ListTemplate } from '@/common/components/templates/List';
import { ConcorrenteGrid } from '@/common/core/grids/crm/concorrente-grid';

export const ConcorrenteList = () => {
return (
<ListTemplate>
<ConcorrenteGrid service={concorrenteService} />
</ListTemplate>
);
};

agora dentro a service precia ser criado uma pasta com o nome da tela e dentro dele todos os servico que forma criado para cada aba siga o padroa de sempre inciiaos com o nome da tela princnaps e apos o nome d aba exemplo conta-endereco-service.ts
siga esse padrao para criar os arquivos  
 import { M8Controllers } from '@/common/core/interfaces/api';
import { Despesa } from '@/common/core/models/financeiro/despesa';
import { BaseService } from '@/common/core/services/base/base-service';
import { makeService } from '@/common/decorators/make-service';

class DespesaService extends BaseService<Despesa> {}

export default makeService(DespesaService, {
model: Despesa,
modelName: 'DespesaModelo',
controller: M8Controllers.Financeiro,
routes: {
load: 'DespesasPesquisaGrid',
find: 'Despesa',
save: 'DespesaFormulario',
delete: 'DespesaExcluir',
logsPrincipal: 'Despesa',
logsColecao: 'tblDespesas',
},
});

deposi vc vai procurar pela pasta common e dentro dela core e models : sempre verifique se nao tem um modelo ja com o mesmo nome e se nao tiver vc vai cria ele dentr da sua respetiva tela sehindo esse padrao import type { MesCompetenciaEnum } from '@/common/core/enums/mes-competencia-enum';
import { Mapper } from '@/common/core/models/base';
import type { AnyObject } from '@/common/core/types/any-object';
import { Required } from '@/common/helpers/class-validator/required';

import type { select2 } from '../../types/select2';

export class ModalidadeNegocioMetaContatoProposta extends Mapper {
fieldMappingKeys = {
'vendedor.id': 'VendedorId',
'vendedor.name': 'VendedorNome',
'regiao.id': 'RegiaoId',
'regiao.name': 'RegiaoNome',

    mes: 'Mes',
    ano: 'Ano',
    valorMeta: 'ValorMeta',
    modalidadeNegocioId: 'ModalidadeNegocioId',

};

@Required()
vendedor?: select2;

@Required()
regiao?: select2;

mes?: MesCompetenciaEnum;

ano?: number;
valorMeta?: number;

constructor(json?: AnyObject) {
super();
this.map(json);
}
}

sempre deixe esse campso asism : 'vendedor.id': 'VendedorId',
'vendedor.name': 'VendedorNome',
'regiao.id': 'RegiaoId',
'regiao.name': 'RegiaoNome',
ppor primeiro depois de espcos esse campos sao todo so select2  
 tbm sempre lembre de nao coloca ro campo id e nem o ativos no modelo
e sempre olcoar as ipagem em vcada campo nesecarios

@Required()
vendedor?: select2;

e maxlength para os campos que preciam dele

isso seria o padrao para criar os arquivos e seu dvido lugar siga iso para geras a tela no frontm8
