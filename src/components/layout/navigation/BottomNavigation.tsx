import Home from "../../../assets/home.svg";
import Book from "../../../assets/book.svg";
import Like from "../../../assets/like.svg";
// import Messages from "../../../assets/messages.svg";
import { Link } from "react-router-dom";


type Props = {
  userId: number;
};

export function BottomNav({userId}: Props) {
    console.log(userId)
    return (
        <div className="bottom-navigation">
            <Link to="/" className="bottom-navigation-button">
                <img src={Home} />
                <span>Главная</span>
            </Link>
            <Link to="/history" className="bottom-navigation-button">
                <img src={Book} />
                <span>История</span>
            </Link>
            <Link id="saved-nav-button" to="/saved" className="bottom-navigation-button">
                <img src={Like} />
                <span>Сохраненные</span>
            </Link>
        </div>
    )
}