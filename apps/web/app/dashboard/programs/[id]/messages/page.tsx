import { Metadata } from 'next';
import WhatsAppTemplatesEditor from './_components/WhatsAppTemplatesEditor';

export const metadata: Metadata = {
  title: 'Messages — LinearCard',
};

export default async function ProgramMessagesPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  return (
    <div className="flex-1 overflow-y-auto">
      <WhatsAppTemplatesEditor programId={id} />
    </div>
  );
}
