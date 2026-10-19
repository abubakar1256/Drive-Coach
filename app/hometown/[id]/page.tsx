import HometownPractice from "../HometownPractice";
export default function HometownPage({params}:{params:{id:string}}){return <HometownPractice routeId={params.id} />;}
