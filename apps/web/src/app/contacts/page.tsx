import Link from 'next/link'

import { LegalPage } from '@/components/layout/legal-page'

export default function ContactsPage() {
  return (
    <LegalPage title="Контакти">
      <p>
        Поки VeilFall перебуває у розробці, технічні питання та повідомлення про
        помилки можна залишати у репозиторії проєкту.
      </p>
      <p>
        <Link
          href="https://github.com/clearfixx/mmorpg/issues"
          className="text-ember hover:text-ember-bright"
        >
          Відкрити звернення на GitHub
        </Link>
      </p>
    </LegalPage>
  )
}
