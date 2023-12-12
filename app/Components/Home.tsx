import { Fragment } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import Banner from "./Banner";
import Table from "./Table";

export default function HomePage() {
    return (
        <Fragment>
            <div className="p-4 sm:ml-64">
                <TopNav />
                <Banner />
                <Table />
            </div>
        </Fragment>
    );
}
