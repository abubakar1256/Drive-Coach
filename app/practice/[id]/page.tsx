import Link from "next/link";
import DriveReport from "../DriveReport";

export const metadata = { title: "Your practice debrief | Drive Coach", robots: { index: false, follow: false } };
export default function PracticeReportPage({ params }: { params: { id: string } }) {
  return <main className="drive-report-page"><nav className="drive-report-nav"><Link className="brand" href="/">Drive Coach</Link><Link href="/dashboard">← Practice history</Link></nav><DriveReport sessionId={params.id} /></main>;
}
