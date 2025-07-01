import DATA from "./JSON/TABLE_DATA.json";
export default function Table() {
    return (
        <div className="flex items-center flex-col bg-destructive-foreground/10 rounded-3xl px-10">
            <h1 className="text-center text-5xl font-bold">Clan Points Feed</h1>
            <table className="w-full mt-2">
                <thead>
                    <tr className="text-2xl font-bold">
                        <th>Event</th>
                        <th>User</th>
                        <th>Points</th>
                        <th>Clan</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody className="text-center ">
                    {DATA.map((item) => (
                        <tr
                            key={item.Date}
                            className="odd:bg-foreground odd:text-background text-lg w-full hover:p-10 rounded-xl border-white/50 group ">
                            <td className="py-2 rounded-l-3xl group-hover:py-4">
                                {item.Event}
                            </td>
                            <td>{item.User}</td>
                            <td>{item.Points}</td>
                            <td>{item.Clan}</td>
                            <td className="py-2 rounded-r-3xl">{item.Date}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
