import Logo from "../../../assets/logo.png";


type Props = {
  title: string;
};

export function TopNav({title}: Props) {
    console.log(title)
    return (
        <div className="top-navigation">
            <img src={Logo}/>
            <span>{title}</span>
        </div>
    )
}