"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Countdown from "react-countdown";

const getProducts = async (id: string) => {
    const ticketPurchase = await supabase.from("ticketPurchase").select("*", { count: "exact", head: true }).eq("ticketId", id);
    const response = await supabase.from("tickets").select().eq("id", id);
    return { ...response, count: ticketPurchase.count };
};

export default function Page() {
    const [value, setValue] = useState("");
    const params = useParams<{ slug: string }>();
    const { data, loading, error, run } = useRequest(getProducts);

    useEffect(() => {
        if (params?.slug) {
            run(params?.slug);
        }
    }, [params]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;

    return (
        <div className="w-full container mx-auto flex gap-2">
            <div className="w-4/12">
                <Image
                    //@ts-ignore
                    src={data?.data[0].image}
                    //@ts-ignore
                    alt={data?.data[0].name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="w-8/12">
                <h1 className="text-3xl ">
                    {
                        //@ts-ignore
                        data?.data[0]?.title
                    }
                </h1>
                <p className="p-10 border bg-slate-100 rounded-full my-6">
                    <span className="flex text-2xl"> Description</span>
                    {
                        //@ts-ignore
                        data?.data[0]?.description
                    }
                </p>

                <div className="grid grid-flow-row grid-cols-2 gap-2">
                    <div className="w-full">
                        <Countdown
                            //@ts-ignore
                            date={new Date(data?.data[0]?.endTime)}
                            className="text-2xl bg-slate-100 rounded-full py-2 flex justify-center items-center w-full h-32"
                        />
                    </div>

                    <div className="w-full">
                        <div className="w-full h-32 bg-slate-100 rounded-full flex justify-center items-center flex-col">
                            <span className="text-4xl">{data?.count}</span>
                            <span className="text-sm">Tickets Solid</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-flow-row grid-cols-2 gap-2 mt-6">
                    <input
                        type="number"
                        placeholder="Enter tickers"
                        className="w-full h-12 bg-slate-100 rounded-full px-10"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                    <button className="w-full h-12 bg-slate-100 rounded-full">Purchase</button>
                </div>
            </div>
        </div>
    );
}
